import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Accommodation } from './entities/accommodation.entity';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { AccommodationDto } from './dto/accommodation.dto';
import { CreateAccommodationDto } from './dto/create-accommodation.dto';
import { AccommodationCategory } from 'src/accommodation-categories/entities/accommodation-category.entity';

@Injectable()
export class AccommodationsService {
  constructor(
    @InjectRepository(Accommodation)
    private readonly placeRepository: Repository<Accommodation>,
    @InjectRepository(AccommodationCategory)
    private readonly categoryRepo: Repository<AccommodationCategory>,
  ) {}

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<AccommodationDto[]> {
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
      skip: (page - 1) * limit,
      take: limit,
    });

    console.timeEnd('DB_FIND_ACCOMMODATIONS');

    return plainToInstance(AccommodationDto, places, { excludeExtraneousValues: true });
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
    return plainToInstance(AccommodationDto, place, {
      excludeExtraneousValues: true,
    });
  }

  async create(data: CreateAccommodationDto): Promise<AccommodationDto> {
    let category: AccommodationCategory | undefined;

    if (data.place_category) {
      const found = await this.categoryRepo.findOne({
        where: { id: data.place_category },
      });

      if (!found) {
        throw new Error(
          `Categoria com id ${data.place_category} não encontrada`,
        );
      }

      category = found;
    }

    const novo = this.placeRepository.create({
      ...data,
      place_category: category,
    });

    const saved: Accommodation = await this.placeRepository.save(novo);

    return plainToInstance(AccommodationDto, saved, {
      excludeExtraneousValues: true,
    });
  }

  async findByCamino(caminoName: string): Promise<Accommodation[]> {
    const normalized = caminoName?.trim();

    if (!normalized) {
      return [];
    }

    const maybeCaminoId = Number(normalized);

    return this.placeRepository
      .createQueryBuilder('place')
      .leftJoinAndSelect('place.camino', 'camino')
      .where(
        Number.isFinite(maybeCaminoId)
          ? 'camino.id = :caminoId OR LOWER(BTRIM(camino.name)) = LOWER(BTRIM(:caminoName))'
          : 'LOWER(BTRIM(camino.name)) = LOWER(BTRIM(:caminoName))',
        Number.isFinite(maybeCaminoId)
          ? { caminoId: maybeCaminoId, caminoName: normalized }
          : { caminoName: normalized },
      )
      .andWhere('place.status = :status', { status: 'approved' })
      .getMany();
  }

  getByBounds(bounds: any) {
    const { south, west, north, east } = bounds;
    return this.placeRepository
      .createQueryBuilder('place')
      .leftJoinAndSelect('place.place_category', 'place_category')
      .leftJoinAndSelect('place.gallery_photos', 'gallery_photos')
      .where('place.latitude BETWEEN :south AND :north', { south, north })
      .andWhere('place.longitude BETWEEN :west AND :east', { west, east })
      .andWhere('place.status = :status', { status: 'approved' })
      .getMany();
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

    return result;
  }

  // ✅ Admin approval methods
  async getPendingAccommodations(): Promise<Accommodation[]> {
    return this.placeRepository.find({
      where: { status: 'pending' },
      relations: ['camino', 'stage', 'gallery_photos', 'place_category'],
    });
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
