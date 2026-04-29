import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Accommodation } from './entities/accommodation.entity';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { AccommodationDto } from './dto/accommodation.dto';
import { CreateAccommodationDto } from './dto/create-accommodation.dto';
import { UpdateAccommodationDto } from './dto/update-accommodation.dto';
import { CreateRemovalRequestDto } from './dto/create-removal-request.dto';
import { AccommodationCategory } from 'src/accommodation-categories/entities/accommodation-category.entity';
import { GalleryPhoto } from 'src/gallery/entities/gallery-photo.entity';
import { PlaceRemovalRequest } from './entities/place-removal-request.entity';

@Injectable()
export class AccommodationsService {
  private readonly readCache = new Map<
    string,
    { expiresAt: number; value: unknown }
  >();

  private readonly cacheTtlMs = (() => {
    const parsed = Number(process.env.ACCOMMODATIONS_CACHE_TTL_MS ?? 30000);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 30000;
  })();

  constructor(
    @InjectRepository(Accommodation)
    private readonly placeRepository: Repository<Accommodation>,
    @InjectRepository(AccommodationCategory)
    private readonly categoryRepo: Repository<AccommodationCategory>,
    @InjectRepository(GalleryPhoto)
    private readonly galleryPhotoRepo: Repository<GalleryPhoto>,
    @InjectRepository(PlaceRemovalRequest)
    private readonly removalRequestRepo: Repository<PlaceRemovalRequest>,
  ) {}

  private getCachedValue<T>(key: string): T | undefined {
    const cached = this.readCache.get(key);

    if (!cached) {
      return undefined;
    }

    if (cached.expiresAt <= Date.now()) {
      this.readCache.delete(key);
      return undefined;
    }

    return cached.value as T;
  }

  private setCachedValue<T>(key: string, value: T): T {
    this.readCache.set(key, {
      value,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return value;
  }

  private invalidateReadCache(): void {
    this.readCache.clear();
  }

  private formatRemovalRequest(request: PlaceRemovalRequest): Record<string, unknown> {
    return {
      id: request.id,
      placeId: request.placeId ?? request.place?.id ?? null,
      accountId: request.accountId ?? request.account?.id ?? null,
      placeName: request.placeName ?? request.place?.place_name ?? '',
      requesterName: request.requesterName ?? request.account?.name ?? '',
      requesterEmail: request.requesterEmail ?? request.account?.email ?? '',
      reason: request.reason ?? '',
      status: request.status,
      rejectionReason: request.rejectionReason ?? null,
      createdAt: request.createdAt,
      reviewedAt: request.reviewedAt ?? null,
    };
  }

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

    const cacheKey = `findAll:${safePage}:${safeLimit}`;
    const cached = this.getCachedValue<AccommodationDto[]>(cacheKey);

    if (cached) {
      return cached;
    }

    console.time('DB_FIND_ACCOMMODATIONS');
    const places = await this.placeRepository.find({
      where: { status: 'approved' },
      relations: [
        'camino',
        'stage',
        'gallery_photos',
        'place_category',
        'prices',
        'account',
      ],
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    console.timeEnd('DB_FIND_ACCOMMODATIONS');

    const dtoList = plainToInstance(AccommodationDto, places, {
      excludeExtraneousValues: true,
    });
    await this.attachServices(dtoList);

    for (let i = 0; i < dtoList.length; i++) {
      const dto = dtoList[i] as any;
      const place = places[i] as any;
      dto.ownerId = place.account?.id ?? null;
      dto.ownerName = place.account?.name ?? null;
    }

    return this.setCachedValue(cacheKey, dtoList);
  }

  async findOne(id: number): Promise<AccommodationDto> {
    const cacheKey = `findOne:${id}`;
    const cached = this.getCachedValue<AccommodationDto>(cacheKey);

    if (cached) {
      return cached;
    }

    const place = await this.placeRepository.findOne({
      where: { id },
      relations: [
        'camino',
        'stage',
        'gallery_photos',
        'place_category',
        'prices',
        'account',
      ],
    });
    if (!place) {
      throw new NotFoundException(`Accommodation com id ${id} não encontrado`);
    }
    const dto = plainToInstance(AccommodationDto, place, {
      excludeExtraneousValues: true,
    });
    await this.attachServices([dto]);

    (dto as any).ownerId = place.account?.id ?? null;
    (dto as any).ownerName = place.account?.name ?? null;

    return this.setCachedValue(cacheKey, dto);
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

    if ((data as any).account_id) {
      (novo as any).account = { id: Number((data as any).account_id) } as any;
    }

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
      relations: ['gallery_photos', 'place_category', 'prices', 'camino', 'stage', 'account'],
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

    (dto as any).ownerId = savedWithRelations.account?.id ?? null;
    (dto as any).ownerName = savedWithRelations.account?.name ?? null;

    this.invalidateReadCache();
    return dto;
  }

  async findByCamino(caminoName: string): Promise<Accommodation[]> {
    const normalized = caminoName?.trim();

    if (!normalized) {
      return [];
    }

    const maybeCaminoId = Number(normalized);
    const cacheKey = `findByCamino:${Number.isInteger(maybeCaminoId) ? maybeCaminoId : normalized.toLowerCase()}`;
    const cached = this.getCachedValue<Accommodation[]>(cacheKey);

    if (cached) {
      return cached;
    }

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

    return this.setCachedValue(cacheKey, places);
  }

  async findByAccount(accountId: number): Promise<AccommodationDto[]> {
    const normalized = Number(accountId);

    if (!Number.isInteger(normalized)) {
      return [];
    }

    const places = await this.placeRepository
      .createQueryBuilder('place')
      .leftJoinAndSelect('place.camino', 'camino')
      .leftJoinAndSelect('place.stage', 'stage')
      .leftJoinAndSelect('place.place_category', 'place_category')
      .leftJoinAndSelect('place.gallery_photos', 'gallery_photos')
      .leftJoinAndSelect('place.prices', 'prices')
      .leftJoinAndSelect('place.account', 'account')
      .where('place.account_id = :accountId', { accountId: normalized })
      .getMany();

    const dtoList = plainToInstance(AccommodationDto, places, {
      excludeExtraneousValues: true,
    });

    await this.attachServices(dtoList);

    for (let i = 0; i < dtoList.length; i++) {
      const dto = dtoList[i] as any;
      const place = places[i] as any;
      dto.ownerId = place.account?.id ?? null;
      dto.ownerName = place.account?.name ?? null;
    }

    return dtoList;
  }

  async getByBounds(bounds: any) {
    const { south, west, north, east } = bounds;
    const cacheKey = `getByBounds:${south}:${west}:${north}:${east}`;
    const cached = this.getCachedValue<Accommodation[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const places = await this.placeRepository
      .createQueryBuilder('place')
      .leftJoinAndSelect('place.place_category', 'place_category')
      .leftJoinAndSelect('place.gallery_photos', 'gallery_photos')
      .where('place.latitude BETWEEN :south AND :north', { south, north })
      .andWhere('place.longitude BETWEEN :west AND :east', { west, east })
      .andWhere('place.status = :status', { status: 'approved' })
      .getMany();

    await this.attachServices(places);

    return this.setCachedValue(cacheKey, places);
  }

  async findAccommodationByPlaceId(placeId: number): Promise<any> {
    const cacheKey = `findAccommodationByPlaceId:${placeId}`;
    const cached = this.getCachedValue<Accommodation>(cacheKey);

    if (cached) {
      return cached;
    }

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

    return this.setCachedValue(cacheKey, result);
  }

  async update(id: number, accountId: number, data: any): Promise<AccommodationDto> {
    const accommodation = await this.placeRepository.findOne({
      where: { id },
      relations: ['account'],
    });

    if (!accommodation) {
      throw new NotFoundException(`Accommodation com id ${id} não encontrado`);
    }

    // Verify ownership
    const ownerAccountId = (accommodation as any).account_id || accommodation.account?.id;
    if (ownerAccountId !== accountId) {
      throw new BadRequestException(
        'Apenas o proprietário pode editar esta acomodação.',
      );
    }

    // Prevent editing approved/rejected accommodations
    if (accommodation.status !== 'pending') {
      throw new BadRequestException(
        `Não é possível editar uma acomodação com status ${accommodation.status}. Apenas acomodações pendentes podem ser editadas.`,
      );
    }

    // Update basic fields
    if (data.place_name !== undefined) accommodation.place_name = data.place_name;
    if (data.address !== undefined) accommodation.address = data.address;
    if (data.region !== undefined) accommodation.region = data.region;
    if (data.phone !== undefined) accommodation.phone = data.phone;
    if (data.email !== undefined) accommodation.email = data.email;
    if (data.website !== undefined) accommodation.website = data.website;
    if (data.location_help !== undefined) accommodation.location_help = data.location_help;
    if (data.pilgrim_exclusive !== undefined) accommodation.pilgrim_exclusive = data.pilgrim_exclusive;
    if (data.allow_reservation !== undefined) accommodation.allow_reservation = data.allow_reservation;
    if (data.latitude !== undefined) accommodation.latitude = data.latitude;
    if (data.longitude !== undefined) accommodation.longitude = data.longitude;

    // Update main photo if provided
    if (data.main_photo !== undefined) {
      accommodation.main_photo = this.toPublicImageUrl(data.main_photo);
    }

    // Handle category update
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
      }

      if (!found) {
        throw new NotFoundException(
          `Categoria ${String(rawCategory)} não encontrada`,
        );
      }

      accommodation.place_category = found;
    }

    // Save updated accommodation
    const saved = await this.placeRepository.save(accommodation);

    // Update gallery photos if provided
    if (data.gallery_photos && Array.isArray(data.gallery_photos)) {
      const galleryPhotoUrls = (data.gallery_photos ?? [])
        .filter((value): value is string => typeof value === 'string')
        .map((url) => url.trim())
        .filter((url) => url.length > 0)
        .map((url) => this.toPublicImageUrl(url));

      // Remove existing gallery photos
      await this.galleryPhotoRepo.delete({ place: { id: saved.id } });

      // Add new ones if provided
      if (galleryPhotoUrls.length > 0) {
        const galleryEntities = galleryPhotoUrls.map((url) =>
          this.galleryPhotoRepo.create({
            url,
            place: saved,
          }),
        );

        await this.galleryPhotoRepo.save(galleryEntities);
      }
    }

    // Fetch updated accommodation with all relations
    const updatedAccommodation = await this.placeRepository.findOne({
      where: { id: saved.id },
      relations: ['gallery_photos', 'place_category', 'prices', 'camino', 'stage', 'account'],
    });

    if (!updatedAccommodation) {
      throw new NotFoundException(
        `Accommodation com id ${saved.id} não encontrado após atualização`,
      );
    }

    const dto = plainToInstance(AccommodationDto, updatedAccommodation, {
      excludeExtraneousValues: true,
    });
    await this.attachServices([dto]);

    (dto as any).ownerId = updatedAccommodation.account?.id ?? null;
    (dto as any).ownerName = updatedAccommodation.account?.name ?? null;

    this.invalidateReadCache();
    return dto;
  }

  async requestRemoval(
    data: CreateRemovalRequestDto,
  ): Promise<Record<string, unknown>> {
    const placeId = Number(data.placeId);
    const accountId = Number(data.accountId);

    if (!Number.isInteger(placeId) || !Number.isInteger(accountId)) {
      throw new BadRequestException('placeId e accountId são obrigatórios.');
    }

    const place = await this.placeRepository.findOne({
      where: { id: placeId },
      relations: ['account'],
    });

    if (!place) {
      throw new NotFoundException(`Accommodation com id ${placeId} não encontrado`);
    }

    const ownerAccountId = place.account?.id ?? null;
    if (ownerAccountId !== accountId) {
      throw new BadRequestException(
        'Apenas o proprietário pode pedir a remoção deste local.',
      );
    }

    const existingRequest = await this.removalRequestRepo.findOne({
      where: {
        placeId,
        accountId,
        status: 'pending',
      },
    });

    if (existingRequest) {
      return this.formatRemovalRequest(existingRequest);
    }

    const request = this.removalRequestRepo.create({
      placeId,
      accountId,
      placeName: place.place_name ?? null,
      requesterName: place.account?.name ?? null,
      requesterEmail: place.account?.email ?? null,
      reason: data.reason?.trim() || null,
      status: 'pending',
    });

    const saved = await this.removalRequestRepo.save(request);
    this.invalidateReadCache();
    return this.formatRemovalRequest(saved);
  }

  // ✅ Admin approval methods
  async getPendingAccommodations(): Promise<any[]> {
    const places = await this.placeRepository.find({
      where: { status: 'pending' },
      relations: ['camino', 'stage', 'gallery_photos', 'place_category', 'account'],
    });

    await this.attachServices(places);

    return places.map((place) => ({
      ...place,
      main_photo: this.toPublicImageUrl(place.main_photo),
      gallery_photos: (place.gallery_photos ?? []).map((photo) =>
        this.toPublicImageUrl(photo.url),
      ),
      ownerId: place.account?.id ?? null,
      ownerName: place.account?.name ?? null,
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

    const saved = await this.placeRepository.save(accommodation);
    this.invalidateReadCache();
    return saved;
  }

  async getPendingRemovalRequests(): Promise<Record<string, unknown>[]> {
    const requests = await this.removalRequestRepo
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.place', 'place')
      .leftJoinAndSelect('request.account', 'account')
      .where('request.status = :status', { status: 'pending' })
      .orderBy('request.createdAt', 'ASC')
      .getMany();

    return requests.map((request) => this.formatRemovalRequest(request));
  }

  async getRemovalRequestsByAccount(accountId: number): Promise<Record<string, unknown>[]> {
    const normalized = Number(accountId);

    if (!Number.isInteger(normalized)) {
      return [];
    }

    const requests = await this.removalRequestRepo
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.place', 'place')
      .leftJoinAndSelect('request.account', 'account')
      .where('request.account_id = :accountId', { accountId: normalized })
      .andWhere('request.status = :status', { status: 'pending' })
      .orderBy('request.createdAt', 'ASC')
      .getMany();

    return requests.map((request) => this.formatRemovalRequest(request));
  }

  async approveRemovalRequest(id: number): Promise<Record<string, unknown>> {
    const request = await this.removalRequestRepo.findOne({
      where: { id },
      relations: ['place', 'account'],
    });

    if (!request) {
      throw new NotFoundException(`Pedido de remoção com id ${id} não encontrado`);
    }

    if (request.placeId) {
      const place = await this.placeRepository.findOne({ where: { id: request.placeId } });
      if (place) {
        try {
          await this.placeRepository.remove(place);
        } catch (e) {
          // If physical delete fails (FK constraints, DB issues), fallback to soft-marking
          try {
            (place as any).status = 'deleted';
            await this.placeRepository.save(place);
          } catch (err) {
            // If even the fallback fails, rethrow original error for visibility
            throw e;
          }
        }
      }
    }

    request.status = 'approved';
    request.reviewedAt = new Date();
    request.rejectionReason = null;

    const saved = await this.removalRequestRepo.save(request);
    this.invalidateReadCache();
    return this.formatRemovalRequest(saved);
  }

  async rejectRemovalRequest(
    id: number,
    rejectionReason?: string,
  ): Promise<Record<string, unknown>> {
    const request = await this.removalRequestRepo.findOne({
      where: { id },
      relations: ['place', 'account'],
    });

    if (!request) {
      throw new NotFoundException(`Pedido de remoção com id ${id} não encontrado`);
    }

    request.status = 'rejected';
    request.reviewedAt = new Date();
    request.rejectionReason = rejectionReason?.trim() || null;

    const saved = await this.removalRequestRepo.save(request);
    return this.formatRemovalRequest(saved);
  }
}
