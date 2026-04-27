import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Accommodation } from './entities/accommodation.entity';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { AccommodationDto } from './dto/accommodation.dto';
import { CreateAccommodationDto } from './dto/create-accommodation.dto';
import { AccommodationCategory } from 'src/accommodation-categories/entities/accommodation-category.entity';
import { GalleryPhoto } from 'src/gallery/entities/gallery-photo.entity';

@Injectable()
export class AccommodationsService {
  constructor(
    @InjectRepository(Accommodation)
    private readonly placeRepository: Repository<Accommodation>,
    @InjectRepository(AccommodationCategory)
    private readonly categoryRepo: Repository<AccommodationCategory>,
    @InjectRepository(GalleryPhoto)
    private readonly galleryPhotoRepo: Repository<GalleryPhoto>,
  ) {}

  private toPublicImageUrl(rawUrl?: string | null): string {
    if (!rawUrl) {
      return '';
    }

    const value = rawUrl.trim();
    if (!value) {
      return '';
    }

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    const base = (process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`)
      .trim()
      .replace(/\/$/, '');

    return `${base}/${value.replace(/^\/+/, '')}`;
  }

  private async attachServices(
    places: Accommodation[] | AccommodationDto[],
  ): Promise<void> {
    if (!places?.length) {
      return;
    }

    const placeIds = places
      .map((place) => Number((place as Accommodation).id))
      .filter((id) => Number.isInteger(id));

    if (!placeIds.length) {
      return;
    }

    const rows = await this.placeRepository.manager
      .createQueryBuilder()
      .from('place_services', 'ps')
      .innerJoin('services', 's', 's.id = ps.service_id')
      .select('ps.place_id', 'placeId')
      .addSelect('s.name', 'serviceName')
      .where('ps.place_id IN (:...placeIds)', { placeIds })
      .getRawMany<{ placeId: string | number; serviceName: string }>();

    const serviceMap = new Map<number, string[]>();

    for (const row of rows) {
      const placeId = Number(row.placeId);

      if (!serviceMap.has(placeId)) {
        serviceMap.set(placeId, []);
      }

      serviceMap.get(placeId)!.push(row.serviceName);
    }

    for (const place of places) {
      const placeId = Number((place as Accommodation).id);
      (place as Accommodation).services = serviceMap.get(placeId) ?? [];
    }
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<AccommodationDto[]> {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0
        ? Math.min(Math.floor(limit), 50)
        : 10;

    console.time('DB_FIND_ACCOMMODATIONS');
    const places = await this.placeRepository.find({
      where: { status: 'approved' },
      relations: [
        'camino',
        'stage',
        'gallery_photos',
        'place_category',
        'prices',
      ],
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    console.timeEnd('DB_FIND_ACCOMMODATIONS');

    const dtoList = plainToInstance(AccommodationDto, places, {
      excludeExtraneousValues: true,
    });
    await this.attachServices(dtoList);

    return dtoList;
  }

  async findOne(id: number): Promise<AccommodationDto> {
    const place = await this.placeRepository.findOne({
      where: { id },
      relations: [
        'camino',
        'stage',
        'gallery_photos',
        'place_category',
        'prices',
      ],
    });
    if (!place) {
      throw new NotFoundException(`Accommodation com id ${id} não encontrado`);
    }
    const dto = plainToInstance(AccommodationDto, place, {
      excludeExtraneousValues: true,
    });
    await this.attachServices([dto]);

    return dto;
  }

  async create(data: CreateAccommodationDto): Promise<AccommodationDto> {
    const galleryPhotoUrls = (data.gallery_photos ?? [])
      .filter((value): value is string => typeof value === 'string')
      .map((url) => url.trim())
      .filter((url) => url.length > 0)
      .map((url) => this.toPublicImageUrl(url));

    let category: AccommodationCategory | undefined;

    if (data.place_category !== undefined && data.place_category !== null) {
      const rawCategory = data.place_category as unknown;
      let found: AccommodationCategory | null = null;

      if (typeof rawCategory === 'number') {
        found = await this.categoryRepo.findOne({
          where: { id: rawCategory },
        });
      } else if (typeof rawCategory === 'string') {
        const normalized = rawCategory.trim();

        if (!normalized) {
          throw new BadRequestException('place_category inválido.');
        }

        const maybeId = Number(normalized);

        if (Number.isInteger(maybeId)) {
          found = await this.categoryRepo.findOne({
            where: { id: maybeId },
          });
        } else {
          found = await this.categoryRepo
            .createQueryBuilder('category')
            .where('LOWER(BTRIM(category.name)) = LOWER(BTRIM(:name))', {
              name: normalized,
            })
            .getOne();
        }
      } else {
        throw new BadRequestException(
          'place_category deve ser um id numérico ou nome da categoria.',
        );
      }

      if (!found) {
        throw new NotFoundException(
          `Categoria ${String(rawCategory)} não encontrada`,
        );
      }

      category = found;
    }

    const { gallery_photos: _ignoredGalleryPhotos, ...placePayload } = data;

    const novo = this.placeRepository.create({
      ...placePayload,
      main_photo: this.toPublicImageUrl(data.main_photo),
      place_category: category,
      gallery_photos: undefined,
    });

    const saved: Accommodation = await this.placeRepository.save(novo);

    if (galleryPhotoUrls.length > 0) {
      const galleryEntities = galleryPhotoUrls.map((url) =>
        this.galleryPhotoRepo.create({
          url,
          place: saved,
        }),
      );

      await this.galleryPhotoRepo.save(galleryEntities);
    }

    const savedWithRelations = await this.placeRepository.findOne({
      where: { id: saved.id },
      relations: ['gallery_photos', 'place_category', 'prices', 'camino', 'stage'],
    });

    if (!savedWithRelations) {
      throw new NotFoundException(
        `Accommodation com id ${saved.id} não encontrado após criação`,
      );
    }

    const dto = plainToInstance(AccommodationDto, savedWithRelations, {
      excludeExtraneousValues: true,
    });
    await this.attachServices([dto]);

    return dto;
  }

  async findByCamino(caminoName: string): Promise<Accommodation[]> {
    const normalized = caminoName?.trim();

    if (!normalized) {
      return [];
    }

    const maybeCaminoId = Number(normalized);

    const query = this.placeRepository
      .createQueryBuilder('place')
      .leftJoinAndSelect('place.camino', 'camino')
      .leftJoinAndSelect('place.stage', 'stage')
      .leftJoinAndSelect('place.place_category', 'place_category');

    if (Number.isInteger(maybeCaminoId)) {
      query.where('camino.id = :caminoId', { caminoId: maybeCaminoId });
    } else {
      query.where('LOWER(BTRIM(camino.name)) = LOWER(BTRIM(:caminoName))', {
        caminoName: normalized,
      });
    }

    query.andWhere('place.status = :status', { status: 'approved' });

    const places = await query.getMany();
    await this.attachServices(places);

    return places;
  }

  async getByBounds(bounds: any) {
    const { south, west, north, east } = bounds;
    const places = await this.placeRepository
      .createQueryBuilder('place')
      .leftJoinAndSelect('place.place_category', 'place_category')
      .leftJoinAndSelect('place.gallery_photos', 'gallery_photos')
      .where('place.latitude BETWEEN :south AND :north', { south, north })
      .andWhere('place.longitude BETWEEN :west AND :east', { west, east })
      .andWhere('place.status = :status', { status: 'approved' })
      .getMany();

    await this.attachServices(places);

    return places;
  }

  async findAccommodationByPlaceId(placeId: number): Promise<any> {
    const result = await this.placeRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.place_category', 'pc')
      .leftJoinAndSelect('p.gallery_photos', 'photos')
      .leftJoinAndSelect('p.prices', 'prices')
      .leftJoinAndSelect('p.camino', 'camino')
      .leftJoinAndSelect('p.stage', 'stage')
      .where('p.id = :placeId', { placeId })
      .andWhere('p.status = :status', { status: 'approved' })
      .getOne();

    if (!result) {
      throw new NotFoundException(`Accommodation com ID ${placeId} não encontrado.`);
    }

    await this.attachServices([result]);

    return result;
  }

  // ✅ Admin approval methods
  async getPendingAccommodations(): Promise<any[]> {
    const places = await this.placeRepository.find({
      where: { status: 'pending' },
      relations: ['camino', 'stage', 'gallery_photos', 'place_category'],
    });

    await this.attachServices(places);

    return places.map((place) => ({
      ...place,
      main_photo: this.toPublicImageUrl(place.main_photo),
      gallery_photos: (place.gallery_photos ?? []).map((photo) =>
        this.toPublicImageUrl(photo.url),
      ),
    }));
  }

  async approveAccommodation(
    id: number,
    rejectionReason?: string,
  ): Promise<Accommodation> {
    const accommodation = await this.placeRepository.findOne({
      where: { id },
    });

    if (!accommodation) {
      throw new NotFoundException(
        `Accommodation com id ${id} não encontrado`,
      );
    }

    if (rejectionReason) {
      accommodation.status = 'rejected';
      accommodation.rejectionReason = rejectionReason;
    } else {
      accommodation.status = 'approved';
      accommodation.approvedAt = new Date();
    }

    return this.placeRepository.save(accommodation);
  }
}
