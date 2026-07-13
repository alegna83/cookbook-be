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
import { Account } from 'src/accounts/account.entity';
import { GalleryPhoto } from 'src/gallery/entities/gallery-photo.entity';
import { PlaceRemovalRequest } from './entities/place-removal-request.entity';
import { PlaceEditRequest } from './entities/place-edit-request.entity';
import { CreateEditRequestDto } from './dto/create-edit-request.dto';
import { ContentModerationService } from 'src/moderation/content-moderation.service';
import { EmailService } from 'src/auth/email.service';

@Injectable()
export class AccommodationsService {
  private readonly readCache = new Map<
    string,
    { expiresAt: number; value: unknown }
  >();

  private readonly pendingReads = new Map<string, Promise<unknown>>();

  private readonly shouldLogTimings =
    process.env.LOG_REQUEST_TIMINGS === 'true';

  private readonly cacheTtlMs = (() => {
    const defaultTtl = process.env.NODE_ENV === 'production' ? 120000 : 30000;
    const parsed = Number(process.env.ACCOMMODATIONS_CACHE_TTL_MS ?? defaultTtl);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultTtl;
  })();

  constructor(
    @InjectRepository(Accommodation)
    private readonly placeRepository: Repository<Accommodation>,
    @InjectRepository(AccommodationCategory)
    private readonly categoryRepo: Repository<AccommodationCategory>,
    @InjectRepository(GalleryPhoto)
    private readonly galleryPhotoRepo: Repository<GalleryPhoto>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(PlaceRemovalRequest)
    private readonly removalRequestRepo: Repository<PlaceRemovalRequest>,
    @InjectRepository(PlaceEditRequest)
    private readonly editRequestRepo: Repository<PlaceEditRequest>,
    private readonly moderationService: ContentModerationService,
    private readonly emailService: EmailService,
  ) {}

  private formatEditRequest(req: PlaceEditRequest): Record<string, unknown> {
    return {
      id: req.id,
      placeId: req.placeId ?? req.place?.id ?? null,
      accountId: req.accountId ?? req.account?.id ?? null,
      requesterName: req.requesterName ?? req.account?.name ?? null,
      requesterEmail: req.requesterEmail ?? req.account?.email ?? null,
      payload: req.payload ?? null,
      status: req.status,
      rejectionReason: req.rejectionReason ?? null,
      createdAt: req.createdAt,
      reviewedAt: req.reviewedAt ?? null,
    };
  }

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

  private async getOrLoad<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.getCachedValue<T>(key);

    if (cached !== undefined) {
      return cached;
    }

    const pending = this.pendingReads.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    const promise = (async () => {
      try {
        const value = await loader();
        return this.setCachedValue(key, value);
      } finally {
        this.pendingReads.delete(key);
      }
    })();

    this.pendingReads.set(key, promise);
    return promise;
  }

  private normalizeBoundsValue(value: number): number {
    return Number(value.toFixed(4));
  }

  private buildBoundsCacheKey(bounds: {
    south: number;
    west: number;
    north: number;
    east: number;
  }): string {
    return `getByBounds:${this.normalizeBoundsValue(bounds.south)}:${this.normalizeBoundsValue(bounds.west)}:${this.normalizeBoundsValue(bounds.north)}:${this.normalizeBoundsValue(bounds.east)}`;
  }

  private logTiming(step: string, startNs: bigint): void {
    if (!this.shouldLogTimings) {
      return;
    }

    const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
    console.log(`[ACCOMMODATIONS_TIMING] ${step}: ${elapsedMs.toFixed(2)}ms`);
  }

  private async getAdminEmails(): Promise<string[]> {
    const admins = await this.accountRepo.find({ where: { userType: 'admin' } });

    return [...new Set(
      admins
        .map((admin) => admin.email?.trim())
        .filter((email): email is string => !!email),
    )];
  }

  private buildAdminNotificationHtml(options: {
    title: string;
    summary: string;
    itemLabel: string;
    itemValue: string;
    requesterName?: string | null;
    requesterEmail?: string | null;
    reason?: string | null;
  }): string {
    const escapeHtml = (value: string) =>
      value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    const rows = [
      ['Item', options.itemValue],
      ['Requester', options.requesterName?.trim() || 'Unknown'],
      ['Requester email', options.requesterEmail?.trim() || 'Unknown'],
    ];

    if (options.reason?.trim()) {
      rows.push(['Reason', options.reason.trim()]);
    }

    const rowsHtml = rows
      .map(
        ([label, value]) => `
          <tr>
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 700; background: #f8fafc; width: 180px;">${escapeHtml(label)}</td>
            <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${escapeHtml(value)}</td>
          </tr>
        `,
      )
      .join('');

    return `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="margin: 0 0 16px; color: #0f172a;">${escapeHtml(options.title)}</h2>
        <p style="margin: 0 0 16px;">${escapeHtml(options.summary)}</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 720px;">
          <tbody>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 700; background: #f8fafc; width: 180px;">${escapeHtml(options.itemLabel)}</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${escapeHtml(options.itemValue)}</td>
            </tr>
            ${rowsHtml}
          </tbody>
        </table>
        <p style="margin: 16px 0 0; color: #475569;">Open the admin panel to review the queue.</p>
      </div>
    `;
  }

  private async notifyAdminsAboutPendingItem(options: {
    subject: string;
    title: string;
    summary: string;
    itemLabel: string;
    itemValue: string;
    requesterName?: string | null;
    requesterEmail?: string | null;
    reason?: string | null;
  }): Promise<void> {
    try {
      const adminEmails = await this.getAdminEmails();

      if (adminEmails.length === 0) {
        return;
      }

      const html = this.buildAdminNotificationHtml(options);

      await Promise.allSettled(
        adminEmails.map((email) =>
          this.emailService.sendCustomEmail(email, options.subject, html),
        ),
      );
    } catch (error) {
      console.error('[AccommodationsService] Failed to notify admins:', error);
    }
  }

  private async notifyRequesterAboutDecision(options: {
    email?: string | null;
    name?: string | null;
    decision: 'approved' | 'rejected';
    itemLabel: string;
    itemName: string;
    reason?: string | null;
  }): Promise<void> {
    const recipient = options.email?.trim();

    if (!recipient) {
      return;
    }

    const decisionLabel = options.decision === 'approved' ? 'approved' : 'rejected';
    const subject = `Your ${options.itemLabel.toLowerCase()} request was ${decisionLabel} - Stays4Pilgrims`;

    const escapeHtml = (value: string) =>
      value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    const reasonRow = options.reason?.trim()
      ? `
        <tr>
          <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 700; background: #f8fafc; width: 180px;">Reason</td>
          <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${escapeHtml(options.reason.trim())}</td>
        </tr>
      `
      : '';

    const html = `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="margin: 0 0 16px; color: #0f172a;">Your ${escapeHtml(options.itemLabel.toLowerCase())} request was ${escapeHtml(decisionLabel)}</h2>
        <p style="margin: 0 0 16px;">Hello ${escapeHtml(options.name?.trim() || 'there')}, your request has been ${escapeHtml(decisionLabel)} by the admin team.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 720px;">
          <tbody>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 700; background: #f8fafc; width: 180px;">${escapeHtml(options.itemLabel)}</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${escapeHtml(options.itemName)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 700; background: #f8fafc; width: 180px;">Decision</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${escapeHtml(decisionLabel)}</td>
            </tr>
            ${reasonRow}
          </tbody>
        </table>
      </div>
    `;

    await this.emailService.sendCustomEmail(recipient, subject, html);
  }

  private async resolveCaminoTreeIds(
    caminoIdentifier: string,
  ): Promise<number[]> {
    const normalized = caminoIdentifier?.trim();

    if (!normalized) {
      return [];
    }

    const maybeCaminoId = Number(normalized);
    const isNumeric = Number.isInteger(maybeCaminoId);

    const rootRows = isNumeric
      ? await this.placeRepository.manager.query(
          `
          WITH RECURSIVE camino_tree AS (
            SELECT id
            FROM caminos
            WHERE id = $1
            UNION ALL
            SELECT c.id
            FROM caminos c
            INNER JOIN camino_tree ct ON c.parent_camino_id = ct.id
          )
          SELECT id FROM camino_tree
          `,
          [maybeCaminoId],
        )
      : await this.placeRepository.manager.query(
          `
          WITH RECURSIVE camino_tree AS (
            SELECT id
            FROM caminos
            WHERE LOWER(BTRIM(name)) = LOWER(BTRIM($1))
            UNION ALL
            SELECT c.id
            FROM caminos c
            INNER JOIN camino_tree ct ON c.parent_camino_id = ct.id
          )
          SELECT id FROM camino_tree
          `,
          [normalized],
        );

    return rootRows
      .map((row: { id?: number | string }) => Number(row.id))
      .filter((id) => Number.isInteger(id));
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

  private filterGalleryPhotosForViewer(
    photos: GalleryPhoto[],
    currentAccountId?: number,
    viewerIsAdmin = false,
  ): GalleryPhoto[] {
    if (viewerIsAdmin) {
      return photos;
    }

    return photos.filter((photo) => {
      const photoStatus = photo.status || 'approved';
      const uploaderId = photo.account?.id ?? null;
      const isOwnPendingPhoto =
        currentAccountId != null &&
        photoStatus === 'pending' &&
        uploaderId != null &&
        Number(uploaderId) === Number(currentAccountId);

      return photoStatus === 'approved' || isOwnPendingPhoto;
    });
  }

  private async buildModeratedGalleryPhotos(
    urls: string[],
    place: Accommodation,
    accountId?: number,
  ): Promise<GalleryPhoto[]> {
    const normalizedUrls = urls
      .map((url) => this.toPublicImageUrl(url))
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (!normalizedUrls.length) {
      return [];
    }

    const moderation = await this.moderationService.moderateImageUrls(
      normalizedUrls,
    );

    if (moderation.decision === 'reject') {
      throw new BadRequestException(
        moderation.reason || 'Image blocked by content moderation.',
      );
    }

    return normalizedUrls.map((url) =>
      this.galleryPhotoRepo.create({
        url,
        place,
        account: accountId ? ({ id: accountId } as any) : undefined,
        status: 'pending',
        approvedAt: null,
        rejectionReason: null,
      }),
    );
  }

  private async attachServices(
    places: Accommodation[] | AccommodationDto[],
  ): Promise<void> {
    const startNs = process.hrtime.bigint();

    if (!places?.length) {
      this.logTiming('attachServices.empty', startNs);
      return;
    }

    const placeIds = places
      .map((place) => Number((place as Accommodation).id))
      .filter((id) => Number.isInteger(id));

    if (!placeIds.length) {
      this.logTiming('attachServices.noValidIds', startNs);
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

    this.logTiming('attachServices.queryAndMap', startNs);
  }

  private filterApprovedPhotos(
    places: Accommodation[] | AccommodationDto[],
    currentAccountId?: number,
    viewerIsAdmin = false,
  ): void {
    if (viewerIsAdmin) {
      console.log(`[PHOTO_FILTER] Admin viewer - returning ALL photos`);
      return;
    }

    for (const place of places) {
      if (
        place.gallery_photos &&
        Array.isArray(place.gallery_photos)
      ) {
        const beforeCount = place.gallery_photos.length;
        place.gallery_photos = (place.gallery_photos as any[]).filter((photo: any) => {
          const photoStatus = photo.status || 'approved';
          const uploaderId = photo.account?.id ?? photo.uploaderId ?? photo.account_id ?? null;
          const isOwnPendingPhoto =
            currentAccountId != null &&
            photoStatus === 'pending' &&
            uploaderId != null &&
            Number(uploaderId) === Number(currentAccountId);

          const shouldInclude = photoStatus === 'approved' || isOwnPendingPhoto;
          console.log(`[PHOTO_FILTER] Photo ID ${photo.id}: status=${photoStatus}, uploaderId=${uploaderId}, currentAccountId=${currentAccountId}, isOwn=${isOwnPendingPhoto}, include=${shouldInclude}`);
          return shouldInclude;
        });
        const afterCount = place.gallery_photos.length;
        console.log(`[PHOTO_FILTER] Place ${place.id}: filtered from ${beforeCount} to ${afterCount} photos`);
      }
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

    const totalStartNs = process.hrtime.bigint();
    const queryStartNs = process.hrtime.bigint();
    const places = await this.placeRepository
      .createQueryBuilder('place')
      .leftJoinAndSelect('place.place_category', 'place_category')
      .where('place.status = :status', { status: 'approved' })
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getMany();
    this.logTiming('findAll.db', queryStartNs);

    const dtoStartNs = process.hrtime.bigint();
    const dtoList = plainToInstance(AccommodationDto, places, {
      excludeExtraneousValues: true,
    });
    this.logTiming('findAll.dtoTransform', dtoStartNs);

    const servicesStartNs = process.hrtime.bigint();
    await this.attachServices(dtoList);
    this.logTiming('findAll.services', servicesStartNs);

    this.logTiming('findAll.total', totalStartNs);

    return this.setCachedValue(cacheKey, dtoList);
  }

  async findOne(id: number, currentAccountId?: number): Promise<AccommodationDto> {
    const cacheKey = `findOne:${id}:${currentAccountId ?? 'guest'}`;
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
        'gallery_photos.account',
        'place_category',
        'prices',
        'account',
      ],
    });
    if (!place) {
      throw new NotFoundException(`Accommodation com id ${id} não encontrado`);
    }
    const currentAccount = currentAccountId
      ? await this.accountRepo.findOne({ where: { id: currentAccountId } })
      : null;
    const viewerIsAdmin = currentAccount?.userType === 'admin';

    const filteredGalleryPhotos = this.filterGalleryPhotosForViewer(
      place.gallery_photos ?? [],
      currentAccountId,
      viewerIsAdmin,
    );

    const dto = plainToInstance(AccommodationDto, {
      ...place,
      gallery_photos: filteredGalleryPhotos,
    }, {
      excludeExtraneousValues: true,
    });
    this.filterApprovedPhotos([dto], currentAccountId, viewerIsAdmin);
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
    const accountId = (data as any).account_id
      ? Number((data as any).account_id)
      : undefined;

    if (galleryPhotoUrls.length > 0) {
      const moderation = await this.moderationService.moderateImageUrls(
        galleryPhotoUrls,
      );

      if (moderation.decision === 'reject') {
        throw new BadRequestException(
          moderation.reason || 'Image blocked by content moderation.',
        );
      }
    }

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
          account: accountId ? ({ id: accountId } as any) : undefined,
          status: 'pending',
          approvedAt: null,
          rejectionReason: null,
        }),
      );

      await this.galleryPhotoRepo.save(galleryEntities);
    }

    const savedWithRelations = await this.placeRepository.findOne({
      where: { id: saved.id },
      relations: [
        'gallery_photos',
        'gallery_photos.account',
        'place_category',
        'prices',
        'camino',
        'stage',
        'account',
      ],
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
    await this.notifyAdminsAboutPendingItem({
      subject: 'Pending accommodation review - Stays4Pilgrims',
      title: 'New accommodation pending review',
      summary: 'A new accommodation was submitted and is waiting for admin approval.',
      itemLabel: 'Accommodation',
      itemValue: savedWithRelations.place_name ?? `Accommodation #${saved.id}`,
      requesterName: savedWithRelations.account?.name ?? null,
      requesterEmail: savedWithRelations.account?.email ?? null,
    });
    return dto;
  }

  async findByCamino(caminoName: string): Promise<Accommodation[]> {
    const normalized = caminoName?.trim();

    if (!normalized) {
      return [];
    }

    const maybeCaminoId = Number(normalized);
    const cacheKey = `findByCamino:${Number.isInteger(maybeCaminoId) ? maybeCaminoId : normalized.toLowerCase()}`;
    return this.getOrLoad(cacheKey, async () => {
      const caminoIds = await this.resolveCaminoTreeIds(normalized);

      if (!caminoIds.length) {
        return [];
      }

      const query = this.placeRepository
        .createQueryBuilder('place')
        .leftJoinAndSelect('place.camino', 'camino')
        .leftJoinAndSelect('place.stage', 'stage')
        .leftJoinAndSelect('place.place_category', 'place_category');

      query.where('camino.id IN (:...caminoIds)', { caminoIds });

      query.andWhere('place.status = :status', { status: 'approved' });

      const places = await query.getMany();
      await this.attachServices(places);

      return places;
    });
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
    const cacheKey = this.buildBoundsCacheKey(bounds);

    return this.getOrLoad(cacheKey, async () => {
      const { south, west, north, east } = bounds;
      const totalStartNs = process.hrtime.bigint();
      const queryStartNs = process.hrtime.bigint();
      const places = await this.placeRepository
        .createQueryBuilder('place')
        .leftJoinAndSelect('place.place_category', 'place_category')
        .leftJoinAndSelect(
          'place.gallery_photos',
          'gallery_photos',
          'gallery_photos.status = :photoStatus',
          { photoStatus: 'approved' },
        )
        .where('place.latitude BETWEEN :south AND :north', { south, north })
        .andWhere('place.longitude BETWEEN :west AND :east', { west, east })
        .andWhere('place.status = :status', { status: 'approved' })
        .getMany();
      this.logTiming('getByBounds.db', queryStartNs);

      const servicesStartNs = process.hrtime.bigint();
      await this.attachServices(places);
      this.logTiming('getByBounds.services', servicesStartNs);

      this.logTiming('getByBounds.total', totalStartNs);

      return places;
    });
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
      .leftJoinAndSelect(
        'p.gallery_photos',
        'photos',
        'photos.status = :photoStatus',
        { photoStatus: 'approved' },
      )
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

    const galleryPhotoUrls = Array.isArray(data.gallery_photos)
      ? (data.gallery_photos ?? [])
          .filter((value): value is string => typeof value === 'string')
          .map((url) => url.trim())
          .filter((url) => url.length > 0)
          .map((url) => this.toPublicImageUrl(url))
      : [];

    if (galleryPhotoUrls.length > 0) {
      const moderation = await this.moderationService.moderateImageUrls(
        galleryPhotoUrls,
      );

      if (moderation.decision === 'reject') {
        throw new BadRequestException(
          moderation.reason || 'Image blocked by content moderation.',
        );
      }
    }

    // Save updated accommodation
    const saved = await this.placeRepository.save(accommodation);

    // Update gallery photos if provided
    if (galleryPhotoUrls.length > 0) {
      // Remove existing gallery photos
      await this.galleryPhotoRepo.delete({ place: { id: saved.id } });

      // Add new ones if provided
      const galleryEntities = galleryPhotoUrls.map((url) =>
        this.galleryPhotoRepo.create({
          url,
          place: saved,
          account: accountId ? ({ id: accountId } as any) : undefined,
          status: 'pending',
          approvedAt: null,
          rejectionReason: null,
        }),
      );

      await this.galleryPhotoRepo.save(galleryEntities);
    }

    // Fetch updated accommodation with all relations
    const updatedAccommodation = await this.placeRepository.findOne({
      where: { id: saved.id },
      relations: ['gallery_photos', 'gallery_photos.account', 'place_category', 'prices', 'camino', 'stage', 'account'],
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

  async addGalleryPhotos(
    placeId: number,
    accountId: number,
    photoUrls: string[],
  ): Promise<AccommodationDto> {
    const normalizedPlaceId = Number(placeId);
    const normalizedAccountId = Number(accountId);

    if (!Number.isInteger(normalizedPlaceId)) {
      throw new BadRequestException('placeId inválido.');
    }

    if (!Number.isInteger(normalizedAccountId)) {
      throw new BadRequestException('accountId inválido.');
    }

    const place = await this.placeRepository.findOne({
      where: { id: normalizedPlaceId },
      relations: ['account'],
    });

    if (!place) {
      throw new NotFoundException(`Accommodation com id ${normalizedPlaceId} não encontrado`);
    }

    const account = await this.accountRepo.findOne({
      where: { id: normalizedAccountId },
    });

    if (!account) {
      throw new NotFoundException(`Account com id ${normalizedAccountId} não encontrado`);
    }

    const urls = (photoUrls ?? [])
      .filter((value): value is string => typeof value === 'string')
      .map((url) => url.trim())
      .filter((url) => url.length > 0)
      .map((url) => this.toPublicImageUrl(url));

    if (urls.length === 0) {
      throw new BadRequestException('Pelo menos uma foto é obrigatória.');
    }

    if (urls.length > 10) {
      throw new BadRequestException('Máximo de 10 fotos permitido.');
    }

    const galleryEntities = await this.buildModeratedGalleryPhotos(
      photoUrls,
      place,
      account.id,
    );

    if (galleryEntities.length > 0) {
      await this.galleryPhotoRepo.save(galleryEntities);
    }

    this.invalidateReadCache();
    await this.notifyAdminsAboutPendingItem({
      subject: 'Pending photo moderation - Stays4Pilgrims',
      title: 'New photos pending review',
      summary: 'A user added new photos to an accommodation and they are waiting for admin approval.',
      itemLabel: 'Accommodation',
      itemValue: place.place_name ?? `Accommodation #${place.id}`,
      requesterName: account.name ?? null,
      requesterEmail: account.email ?? null,
    });
    return this.findOne(normalizedPlaceId, normalizedAccountId);
  }

  async approvePhoto(photoId: number): Promise<AccommodationDto> {
    const normalizedPhotoId = Number(photoId);

    if (!Number.isInteger(normalizedPhotoId)) {
      throw new BadRequestException('photoId inválido.');
    }

    const photo = await this.galleryPhotoRepo.findOne({
      where: { id: normalizedPhotoId },
      relations: [
        'place',
        'place.gallery_photos',
        'place.gallery_photos.account',
        'place.place_category',
        'place.prices',
        'place.camino',
        'place.stage',
        'place.account',
        'account',
      ],
    });

    if (!photo) {
      throw new NotFoundException(`Foto com id ${normalizedPhotoId} não encontrada`);
    }

    photo.status = 'approved';
    photo.approvedAt = new Date();
    photo.rejectionReason = null;

    await this.galleryPhotoRepo.save(photo);
    this.invalidateReadCache();

    await this.notifyRequesterAboutDecision({
      email: photo.account?.email ?? null,
      name: photo.account?.name ?? null,
      decision: 'approved',
      itemLabel: 'Photo',
      itemName: photo.place?.place_name ?? `Accommodation #${photo.place?.id ?? ''}`,
    });

    return this.findOne(Number(photo.place.id));
  }

  async rejectPhoto(
    photoId: number,
    rejectionReason?: string,
  ): Promise<AccommodationDto> {
    const normalizedPhotoId = Number(photoId);

    if (!Number.isInteger(normalizedPhotoId)) {
      throw new BadRequestException('photoId inválido.');
    }

    const photo = await this.galleryPhotoRepo.findOne({
      where: { id: normalizedPhotoId },
      relations: [
        'place',
        'place.gallery_photos',
        'place.gallery_photos.account',
        'place.place_category',
        'place.prices',
        'place.camino',
        'place.stage',
        'place.account',
        'account',
      ],
    });

    if (!photo) {
      throw new NotFoundException(`Foto com id ${normalizedPhotoId} não encontrada`);
    }

    photo.status = 'rejected';
    photo.rejectionReason = rejectionReason?.trim() || 'Rejected by admin.';
    photo.approvedAt = null;

    await this.galleryPhotoRepo.save(photo);
    this.invalidateReadCache();

    await this.notifyRequesterAboutDecision({
      email: photo.account?.email ?? null,
      name: photo.account?.name ?? null,
      decision: 'rejected',
      itemLabel: 'Photo',
      itemName: photo.place?.place_name ?? `Accommodation #${photo.place?.id ?? ''}`,
      reason: photo.rejectionReason,
    });

    return this.findOne(Number(photo.place.id));
  }

  async getPendingPhotosForAccommodation(
    placeId: number,
  ): Promise<AccommodationDto> {
    const normalizedPlaceId = Number(placeId);

    if (!Number.isInteger(normalizedPlaceId)) {
      throw new BadRequestException('placeId inválido.');
    }

    const place = await this.placeRepository.findOne({
      where: { id: normalizedPlaceId },
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
      throw new NotFoundException(`Accommodation com id ${normalizedPlaceId} não encontrado`);
    }

    if (place.gallery_photos && Array.isArray(place.gallery_photos)) {
      place.gallery_photos = place.gallery_photos.filter(
        (photo: any) => photo.status === 'pending',
      );
    }

    const dto = plainToInstance(AccommodationDto, place, {
      excludeExtraneousValues: true,
    });
    await this.attachServices([dto]);

    (dto as any).ownerId = place.account?.id ?? null;
    (dto as any).ownerName = place.account?.name ?? null;

    return dto;
  }

  async getPendingPhotosAdmin(): Promise<AccommodationDto[]> {
    try {
      const accommodations = await this.placeRepository
        .createQueryBuilder('place')
        .leftJoinAndSelect('place.gallery_photos', 'photos')
        .leftJoinAndSelect('photos.account', 'photo_account')
        .leftJoinAndSelect('place.place_category', 'place_category')
        .leftJoinAndSelect('place.account', 'account')
        .where('photos.status = :status', { status: 'pending' })
        .andWhere('place.status = :placeStatus', { placeStatus: 'approved' })
        .distinct(true)
        .getMany();

      const dtos = plainToInstance(AccommodationDto, accommodations, {
        excludeExtraneousValues: true,
      });
      await this.attachServices(dtos);

      accommodations.forEach((place, index) => {
        (dtos[index] as any).ownerId = place.account?.id ?? null;
        (dtos[index] as any).ownerName = place.account?.name ?? null;
      });

      return dtos;
    } catch (e) {
      throw new BadRequestException(`Error fetching pending photos: ${e.message}`);
    }
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
    await this.notifyAdminsAboutPendingItem({
      subject: 'Pending removal request - Stays4Pilgrims',
      title: 'New removal request pending review',
      summary: 'A user requested the removal of an accommodation and it is waiting for admin approval.',
      itemLabel: 'Accommodation',
      itemValue: place.place_name ?? `Accommodation #${place.id}`,
      requesterName: saved.requesterName ?? place.account?.name ?? null,
      requesterEmail: saved.requesterEmail ?? place.account?.email ?? null,
      reason: saved.reason ?? null,
    });
    return this.formatRemovalRequest(saved);
  }

  // User submits an edit proposal for an existing accommodation
  async requestEdit(data: CreateEditRequestDto): Promise<Record<string, unknown>> {
    const placeId = Number(data.placeId);
    const accountId = Number(data.accountId);

    if (!Number.isInteger(placeId) || !Number.isInteger(accountId)) {
      throw new BadRequestException('placeId e accountId são obrigatórios.');
    }

    const place = await this.placeRepository.findOne({ where: { id: placeId }, relations: ['account'] });

    if (!place) {
      throw new NotFoundException(`Accommodation com id ${placeId} não encontrado`);
    }

    const account = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException(`Account com id ${accountId} não encontrado`);
    }

    const existing = await this.editRequestRepo.findOne({ where: { placeId, accountId, status: 'pending' } });
    if (existing) {
      return this.formatEditRequest(existing);
    }

    const request = this.editRequestRepo.create({
      placeId,
      accountId,
      requesterName: account.name ?? null,
      requesterEmail: account.email ?? null,
      payload: data.payload ?? null,
      status: 'pending',
    });

    const saved = await this.editRequestRepo.save(request);
    this.invalidateReadCache();
    await this.notifyAdminsAboutPendingItem({
      subject: 'Pending edit request - Stays4Pilgrims',
      title: 'New edit request pending review',
      summary: 'A user submitted changes to an accommodation and it is waiting for admin approval.',
      itemLabel: 'Accommodation',
      itemValue: place.place_name ?? `Accommodation #${place.id}`,
      requesterName: saved.requesterName ?? account.name ?? null,
      requesterEmail: saved.requesterEmail ?? account.email ?? null,
    });
    return this.formatEditRequest(saved);
  }

  async getPendingEditRequests(): Promise<Record<string, unknown>[]> {
    const requests = await this.editRequestRepo.find({
      where: { status: 'pending' },
      relations: ['place', 'account'],
      order: { createdAt: 'ASC' },
    });

    return requests.map((r) => this.formatEditRequest(r));
  }

  async getEditRequestsByAccount(accountId: number): Promise<Record<string, unknown>[]> {
    const normalized = Number(accountId);

    if (!Number.isInteger(normalized)) {
      return [];
    }

    const requests = await this.editRequestRepo.find({
      where: { accountId: normalized },
      relations: ['place', 'account'],
      order: { createdAt: 'DESC' },
    });

    return requests.map((r) => this.formatEditRequest(r));
  }

  // Admin approves an edit request: apply payload to accommodation
  async approveEditRequest(id: number): Promise<Record<string, unknown>> {
    const req = await this.editRequestRepo.findOne({ where: { id }, relations: ['place', 'account'] });

    if (!req) {
      throw new NotFoundException(`Edit request com id ${id} não encontrado`);
    }

    if (!req.placeId || !req.payload) {
      req.status = 'rejected';
      req.rejectionReason = 'Pedido inválido ou sem payload.';
      req.reviewedAt = new Date();
      const savedReq = await this.editRequestRepo.save(req);
      await this.notifyRequesterAboutDecision({
        email: req.requesterEmail ?? req.account?.email ?? null,
        name: req.requesterName ?? req.account?.name ?? null,
        decision: 'rejected',
        itemLabel: 'Edit request',
        itemName: req.place?.place_name ?? `Accommodation #${req.placeId ?? ''}`,
        reason: req.rejectionReason,
      });
      return this.formatEditRequest(savedReq);
    }

    const place = await this.placeRepository.findOne({ where: { id: req.placeId }, relations: ['gallery_photos', 'account'] });

    if (!place) {
      throw new NotFoundException(`Accommodation com id ${req.placeId} não encontrado`);
    }

    const payload = req.payload as Record<string, any>;

    // Apply permitted fields only
    const updatableFields = [
      'place_name',
      'address',
      'region',
      'phone',
      'email',
      'website',
      'location_help',
      'pilgrim_exclusive',
      'allow_reservation',
      'latitude',
      'longitude',
      'main_photo',
      'place_category',
      'services',
      'nearbyActivities',
    ];

    for (const key of Object.keys(payload)) {
      if (updatableFields.includes(key)) {
        if (key === 'main_photo') {
          place.main_photo = this.toPublicImageUrl(payload[key]);
        } else if (key === 'place_category') {
          // try to resolve category if passed
          const rawCategory = payload[key];
          if (rawCategory !== undefined && rawCategory !== null) {
            let found: AccommodationCategory | null = null;
            if (typeof rawCategory === 'number') {
              found = await this.categoryRepo.findOne({ where: { id: rawCategory } });
            } else if (typeof rawCategory === 'string') {
              const maybeId = Number(rawCategory.trim());
              if (Number.isInteger(maybeId)) {
                found = await this.categoryRepo.findOne({ where: { id: maybeId } });
              } else {
                found = await this.categoryRepo
                  .createQueryBuilder('category')
                  .where('LOWER(BTRIM(category.name)) = LOWER(BTRIM(:name))', { name: rawCategory.trim() })
                  .getOne();
              }
            }
            if (found) {
              place.place_category = found;
            }
          }
        } else if (key === 'latitude' || key === 'longitude') {
          (place as any)[key] = Number(payload[key]);
        } else if (key === 'services' || key === 'nearbyActivities') {
          const value = payload[key];
          (place as any)[key] = Array.isArray(value)
            ? value.map((item) => String(item).trim()).filter((item) => item.length > 0)
            : [];
        } else {
          (place as any)[key] = payload[key];
        }
      }
    }

    // If gallery_photos provided in payload, add as pending photos (moderated)
    if (Array.isArray(payload.gallery_photos) && payload.gallery_photos.length > 0) {
      const galleryUrls = payload.gallery_photos.map((u: any) => this.toPublicImageUrl(String(u)));
      const moderated = await this.moderationService.moderateImageUrls(galleryUrls);
      if (moderated.decision === 'reject') {
        // reject the edit request due to moderation
        req.status = 'rejected';
        req.rejectionReason = moderated.reason || 'Image blocked by moderation.';
        req.reviewedAt = new Date();
        const savedReq = await this.editRequestRepo.save(req);
        await this.notifyRequesterAboutDecision({
          email: req.requesterEmail ?? req.account?.email ?? null,
          name: req.requesterName ?? req.account?.name ?? null,
          decision: 'rejected',
          itemLabel: 'Edit request',
          itemName: req.place?.place_name ?? `Accommodation #${req.placeId ?? ''}`,
          reason: req.rejectionReason,
        });
        return this.formatEditRequest(savedReq);
      }

      // remove previous gallery photos and add new ones as pending
      await this.galleryPhotoRepo.delete({ place: { id: place.id } });
      const galleryEntities = galleryUrls.map((url: string) => this.galleryPhotoRepo.create({
        url,
        place,
        account: req.account ? ({ id: req.account.id } as any) : undefined,
        status: 'pending',
        approvedAt: null,
        rejectionReason: null,
      }));
      await this.galleryPhotoRepo.save(galleryEntities);
    }

    // Save place changes
    await this.placeRepository.save(place);

    req.status = 'approved';
    req.reviewedAt = new Date();
    req.rejectionReason = null;
    const savedReq = await this.editRequestRepo.save(req);
    this.invalidateReadCache();
    await this.notifyRequesterAboutDecision({
      email: req.requesterEmail ?? req.account?.email ?? null,
      name: req.requesterName ?? req.account?.name ?? null,
      decision: 'approved',
      itemLabel: 'Edit request',
      itemName: req.place?.place_name ?? `Accommodation #${req.placeId ?? ''}`,
    });
    return this.formatEditRequest(savedReq);
  }

  async rejectEditRequest(id: number, rejectionReason?: string): Promise<Record<string, unknown>> {
    const req = await this.editRequestRepo.findOne({ where: { id }, relations: ['place', 'account'] });

    if (!req) {
      throw new NotFoundException(`Edit request com id ${id} não encontrado`);
    }

    req.status = 'rejected';
    req.reviewedAt = new Date();
    req.rejectionReason = rejectionReason?.trim() || null;

    const saved = await this.editRequestRepo.save(req);
    return this.formatEditRequest(saved);
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

  async getPendingPhotos(): Promise<any[]> {
    const photos = await this.galleryPhotoRepo.find({
      where: { status: 'pending' },
      relations: ['place', 'place.account', 'place.place_category', 'account'],
      order: { createdAt: 'ASC' },
    });

    return photos.map((photo) => ({
      id: photo.id,
      url: this.toPublicImageUrl(photo.url),
      placeId: photo.place?.id ?? null,
      placeName: photo.place?.place_name ?? null,
      accountId: photo.account?.id ?? null,
      uploaderName: photo.account?.name ?? null,
      createdAt: photo.createdAt,
      rejectionReason: photo.rejectionReason ?? null,
    }));
  }

  async approveAccommodation(
    id: number,
    rejectionReason?: string,
  ): Promise<Accommodation> {
    const accommodation = await this.placeRepository.findOne({
      where: { id },
      relations: ['account'],
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
    await this.notifyRequesterAboutDecision({
      email: accommodation.account?.email ?? null,
      name: accommodation.account?.name ?? null,
      decision: rejectionReason ? 'rejected' : 'approved',
      itemLabel: 'Accommodation',
      itemName: accommodation.place_name ?? `Accommodation #${accommodation.id}`,
      reason: rejectionReason ?? null,
    });
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
    await this.notifyRequesterAboutDecision({
      email: request.requesterEmail ?? request.account?.email ?? null,
      name: request.requesterName ?? request.account?.name ?? null,
      decision: 'approved',
      itemLabel: 'Removal request',
      itemName: request.placeName ?? request.place?.place_name ?? `Accommodation #${request.placeId ?? ''}`,
    });
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
    await this.notifyRequesterAboutDecision({
      email: request.requesterEmail ?? request.account?.email ?? null,
      name: request.requesterName ?? request.account?.name ?? null,
      decision: 'rejected',
      itemLabel: 'Removal request',
      itemName: request.placeName ?? request.place?.place_name ?? `Accommodation #${request.placeId ?? ''}`,
      reason: request.rejectionReason,
    });
    return this.formatRemovalRequest(saved);
  }
}
