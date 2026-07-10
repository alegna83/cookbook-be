import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccommodationsService } from './accommodations.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Accommodation } from './entities/accommodation.entity';
import { AccommodationCategory } from '../accommodation-categories/entities/accommodation-category.entity';
import { GalleryPhoto } from '../gallery/entities/gallery-photo.entity';
import { Account } from '../accounts/account.entity';
import { PlaceRemovalRequest } from './entities/place-removal-request.entity';
import { PlaceEditRequest } from './entities/place-edit-request.entity';
import { ContentModerationService } from '../moderation/content-moderation.service';

describe('AccommodationsService (unit)', () => {
  let service: AccommodationsService;
  let placeRepo: { findOne: jest.Mock; save: jest.Mock; remove: jest.Mock; create: jest.Mock; createQueryBuilder: jest.Mock; manager: any };
  let accountRepo: { findOne: jest.Mock };
  let categoryRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let galleryPhotoRepo: { create: jest.Mock; save: jest.Mock; delete: jest.Mock; findOne: jest.Mock; find: jest.Mock };
  let removalRequestRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; find: jest.Mock; createQueryBuilder: jest.Mock };
  let editRequestRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; find: jest.Mock };

  const createQueryBuilderMock = (rows: any[] = [], one: any = null) => {
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
      getOne: jest.fn().mockResolvedValue(one),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
    };

    return qb;
  };

  beforeEach(async () => {
    placeRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(),
      manager: {
        query: jest.fn(),
        createQueryBuilder: jest.fn(),
      },
    };
    categoryRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
    galleryPhotoRepo = {
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };
    removalRequestRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    editRequestRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };
    accountRepo = { findOne: jest.fn() };
    const moderationMock = { moderateImageUrls: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccommodationsService,
        { provide: getRepositoryToken(Accommodation), useValue: placeRepo },
        { provide: getRepositoryToken(AccommodationCategory), useValue: categoryRepo },
        { provide: getRepositoryToken(GalleryPhoto), useValue: galleryPhotoRepo },
        { provide: getRepositoryToken(Account), useValue: accountRepo },
        { provide: getRepositoryToken(PlaceRemovalRequest), useValue: removalRequestRepo },
        { provide: getRepositoryToken(PlaceEditRequest), useValue: editRequestRepo },
        { provide: ContentModerationService, useValue: moderationMock },
      ],
    }).compile();

    service = module.get<AccommodationsService>(AccommodationsService);
  });

  it('create should throw when moderation rejects images', async () => {
    (service as any).moderationService = {
      moderateImageUrls: jest.fn().mockResolvedValue({ decision: 'reject', reason: 'blocked' }),
    };

    await expect(service.create({ gallery_photos: ['http://x/y.jpg'], place_category: null } as any)).rejects.toThrow();
  });

  it('findOne should throw when the accommodation does not exist', async () => {
    placeRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findByCamino should return empty array when camino name is blank', async () => {
    const result = await service.findByCamino('   ');

    expect(result).toEqual([]);
  });

  it('findByCamino should query by numeric camino id', async () => {
    (placeRepo.manager.query as jest.Mock).mockResolvedValue([{ id: 1 }, { id: 57 }]);
    const qb = createQueryBuilderMock([{ id: 1 }]);
    placeRepo.createQueryBuilder.mockReturnValue(qb);
    jest.spyOn(service as any, 'attachServices').mockResolvedValue(undefined);

    const result = await service.findByCamino('1');

    expect(result).toEqual([{ id: 1 }]);
    expect(placeRepo.manager.query).toHaveBeenCalled();
    expect(placeRepo.createQueryBuilder).toHaveBeenCalled();
  });

  it('findByCamino should return empty array when caminho tree has no ids', async () => {
    (placeRepo.manager.query as jest.Mock).mockResolvedValue([]);

    const result = await service.findByCamino('57');

    expect(result).toEqual([]);
    expect(placeRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('findByAccount should return empty array for invalid account id', async () => {
    const result = await service.findByAccount(Number.NaN);

    expect(result).toEqual([]);
  });

  it('findByAccount should query places for a valid account id', async () => {
    const qb = createQueryBuilderMock([{ id: 1, account: { id: 2, name: 'Host' } }]);
    placeRepo.createQueryBuilder.mockReturnValue(qb);
    jest.spyOn(service as any, 'attachServices').mockResolvedValue(undefined);

    const result = await service.findByAccount(2);

    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 1,
        ownerId: 2,
        ownerName: 'Host',
      }),
    );
    expect(placeRepo.createQueryBuilder).toHaveBeenCalled();
  });

  it('findAccommodationByPlaceId should throw when the place is not found', async () => {
    const qb = createQueryBuilderMock([], null);
    placeRepo.createQueryBuilder.mockReturnValue(qb);

    await expect(service.findAccommodationByPlaceId(42)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getByBounds should query by bounding box and return results', async () => {
    const qb = createQueryBuilderMock([{ id: 1 }]);
    placeRepo.createQueryBuilder.mockReturnValue(qb);
    jest.spyOn(service as any, 'attachServices').mockResolvedValue(undefined);

    const result = await service.getByBounds({ south: 1, west: 2, north: 3, east: 4 });

    expect(result).toEqual([{ id: 1 }]);
    expect(placeRepo.createQueryBuilder).toHaveBeenCalled();
  });

  it('requestRemoval should reject invalid ids', async () => {
    await expect(
      service.requestRemoval({ placeId: 'x' as any, accountId: 'y' as any }),
    ).rejects.toThrow('placeId e accountId são obrigatórios.');
  });

  it('requestRemoval should return existing pending request', async () => {
    placeRepo.findOne.mockResolvedValue({ id: 10, account: { id: 5, name: 'Host', email: 'host@example.com' }, place_name: 'Place' });
    removalRequestRepo.findOne.mockResolvedValue({
      id: 99,
      placeId: 10,
      accountId: 5,
      placeName: 'Place',
      requesterName: 'Host',
      requesterEmail: 'host@example.com',
      reason: 'Need delete',
      status: 'pending',
      reviewedAt: null,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.requestRemoval({ placeId: 10, accountId: 5, reason: 'Need delete' });

    expect(result).toEqual(expect.objectContaining({ id: 99, status: 'pending' }));
    expect(removalRequestRepo.create).not.toHaveBeenCalled();
  });

  it('requestRemoval should create a new request', async () => {
    placeRepo.findOne.mockResolvedValue({ id: 10, account: { id: 5, name: 'Host', email: 'host@example.com' }, place_name: 'Place' });
    removalRequestRepo.findOne.mockResolvedValue(null);
    removalRequestRepo.create.mockReturnValue({ id: 1, status: 'pending' });
    removalRequestRepo.save.mockResolvedValue({
      id: 1,
      placeId: 10,
      accountId: 5,
      placeName: 'Place',
      requesterName: 'Host',
      requesterEmail: 'host@example.com',
      reason: 'Need delete',
      status: 'pending',
      reviewedAt: null,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.requestRemoval({ placeId: 10, accountId: 5, reason: 'Need delete' });

    expect(removalRequestRepo.create).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ id: 1, status: 'pending' }));
  });

  it('requestRemoval should reject when caller is not owner', async () => {
    placeRepo.findOne.mockResolvedValue({ id: 10, account: { id: 99, name: 'Other', email: 'other@example.com' } });

    await expect(
      service.requestRemoval({ placeId: 10, accountId: 5, reason: 'Need delete' }),
    ).rejects.toThrow('Apenas o proprietário pode pedir a remoção deste local.');
  });

  it('requestRemoval should reject when place does not exist', async () => {
    placeRepo.findOne.mockResolvedValue(null);

    await expect(
      service.requestRemoval({ placeId: 10, accountId: 5, reason: 'Need delete' }),
    ).rejects.toThrow('Accommodation com id 10 não encontrado');
  });

  it('requestEdit should reject invalid ids', async () => {
    await expect(
      service.requestEdit({ placeId: 'x' as any, accountId: 'y' as any, payload: {} }),
    ).rejects.toThrow('placeId e accountId são obrigatórios.');
  });

  it('requestEdit should create a new edit request', async () => {
    placeRepo.findOne.mockResolvedValue({ id: 10, account: { id: 5 } });
    accountRepo.findOne.mockResolvedValue({ id: 5, name: 'Host', email: 'host@example.com' });
    editRequestRepo.findOne.mockResolvedValue(null);
    editRequestRepo.create.mockReturnValue({ id: 2, status: 'pending' });
    editRequestRepo.save.mockResolvedValue({
      id: 2,
      placeId: 10,
      accountId: 5,
      requesterName: 'Host',
      requesterEmail: 'host@example.com',
      payload: { place_name: 'New name' },
      status: 'pending',
      reviewedAt: null,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.requestEdit({ placeId: 10, accountId: 5, payload: { place_name: 'New name' } });

    expect(editRequestRepo.create).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ id: 2, status: 'pending' }));
  });

  it('requestEdit should return existing pending request when one exists', async () => {
    placeRepo.findOne.mockResolvedValue({ id: 10, account: { id: 5 } });
    accountRepo.findOne.mockResolvedValue({ id: 5, name: 'Host', email: 'host@example.com' });
    editRequestRepo.findOne.mockResolvedValue({
      id: 22,
      placeId: 10,
      accountId: 5,
      requesterName: 'Host',
      requesterEmail: 'host@example.com',
      payload: { place_name: 'Existing' },
      status: 'pending',
      rejectionReason: null,
      createdAt: new Date(),
      reviewedAt: null,
      place: { id: 10 },
      account: { id: 5 },
    });

    const result = await service.requestEdit({ placeId: 10, accountId: 5, payload: { place_name: 'New name' } });

    expect(result).toEqual(expect.objectContaining({ id: 22, status: 'pending' }));
    expect(editRequestRepo.create).not.toHaveBeenCalled();
  });

  it('requestEdit should reject when account does not exist', async () => {
    placeRepo.findOne.mockResolvedValue({ id: 10, account: { id: 5 } });
    accountRepo.findOne.mockResolvedValue(null);

    await expect(
      service.requestEdit({ placeId: 10, accountId: 5, payload: { place_name: 'New name' } }),
    ).rejects.toThrow('Account com id 5 não encontrado');
  });

  it('rejectEditRequest should reject missing request', async () => {
    editRequestRepo.findOne.mockResolvedValue(null);

    await expect(service.rejectEditRequest(55)).rejects.toThrow('Edit request com id 55 não encontrado');
  });

  it('approveAccommodation should approve when found', async () => {
    placeRepo.findOne.mockResolvedValue({ id: 10, status: 'pending' });
    placeRepo.save.mockResolvedValue({ id: 10, status: 'approved' });

    const result = await service.approveAccommodation(10);

    expect(result).toEqual({ id: 10, status: 'approved' });
  });

  it('approveAccommodation should reject when not found', async () => {
    placeRepo.findOne.mockResolvedValue(null);

    await expect(service.approveAccommodation(10)).rejects.toThrow('Accommodation com id 10 não encontrado');
  });

  it('getPendingPhotos should map pending photos to public URLs', async () => {
    galleryPhotoRepo.find.mockResolvedValue([
      {
        id: 1,
        url: 'uploads/photo.jpg',
        place: { id: 10, place_name: 'Place' },
        account: { id: 2, name: 'Uploader' },
        createdAt: new Date(),
        rejectionReason: null,
      },
    ]);

    const result = await service.getPendingPhotos();

    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 1,
        url: expect.stringContaining('uploads/photo.jpg'),
        placeId: 10,
        placeName: 'Place',
        accountId: 2,
        uploaderName: 'Uploader',
      }),
    );
  });

  it('getPendingPhotosAdmin should return mapped pending accommodations', async () => {
    const qb = createQueryBuilderMock([
      {
        id: 10,
        main_photo: 'uploads/main.jpg',
        gallery_photos: [{ url: 'uploads/a.jpg' }],
        account: { id: 2, name: 'Host' },
      },
    ]);
    qb.distinct = jest.fn().mockReturnThis();
    placeRepo.createQueryBuilder.mockReturnValue(qb);
    jest.spyOn(service as any, 'attachServices').mockResolvedValue(undefined);

    const result = await service.getPendingPhotosAdmin();

    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 10,
        ownerId: 2,
        ownerName: 'Host',
      }),
    );
  });

  it('getPendingRemovalRequests should map pending requests', async () => {
    const qb = createQueryBuilderMock([
      {
        id: 1,
        placeId: 10,
        accountId: 5,
        placeName: 'Place',
        requesterName: 'Host',
        requesterEmail: 'host@example.com',
        reason: 'No longer needed',
        status: 'pending',
        rejectionReason: null,
        createdAt: new Date(),
        reviewedAt: null,
      },
    ]);
    removalRequestRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getPendingRemovalRequests();

    expect(result[0]).toEqual(expect.objectContaining({ id: 1, status: 'pending' }));
  });

  it('getRemovalRequestsByAccount should return empty array for invalid account id', async () => {
    const result = await service.getRemovalRequestsByAccount(Number.NaN);

    expect(result).toEqual([]);
  });

  it('approveRemovalRequest should approve and remove place', async () => {
    const request = {
      id: 1,
      placeId: 10,
      accountId: 5,
      placeName: 'Place',
      requesterName: 'Host',
      requesterEmail: 'host@example.com',
      reason: 'No longer needed',
      status: 'pending',
      reviewedAt: null,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      place: { id: 10 },
      account: { id: 5 },
    };

    removalRequestRepo.findOne.mockResolvedValue(request);
    placeRepo.findOne.mockResolvedValue({ id: 10 });
    placeRepo.remove.mockResolvedValue(undefined);
    removalRequestRepo.save.mockResolvedValue({ ...request, status: 'approved', reviewedAt: new Date(), rejectionReason: null });

    const result = await service.approveRemovalRequest(1);

    expect(placeRepo.remove).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ id: 1, status: 'approved' }));
  });

  it('approveRemovalRequest should reject missing request', async () => {
    removalRequestRepo.findOne.mockResolvedValue(null);

    await expect(service.approveRemovalRequest(404)).rejects.toThrow('Pedido de remoção com id 404 não encontrado');
  });

  it('approveRemovalRequest should fall back to save when remove fails', async () => {
    const request = {
      id: 2,
      placeId: 20,
      accountId: 6,
      placeName: 'Place 2',
      requesterName: 'Host 2',
      requesterEmail: 'host2@example.com',
      reason: 'No longer needed',
      status: 'pending',
      reviewedAt: null,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      place: { id: 20 },
      account: { id: 6 },
    };

    removalRequestRepo.findOne.mockResolvedValue(request);
    placeRepo.findOne.mockResolvedValue({ id: 20 });
    placeRepo.remove.mockRejectedValue(new Error('fk violation'));
    placeRepo.save.mockResolvedValue({ id: 20, status: 'deleted' });
    removalRequestRepo.save.mockResolvedValue({ ...request, status: 'approved', reviewedAt: new Date(), rejectionReason: null });

    const result = await service.approveRemovalRequest(2);

    expect(placeRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'deleted' }));
    expect(result).toEqual(expect.objectContaining({ id: 2, status: 'approved' }));
  });

  it('approvePhoto should reject invalid photo id', async () => {
    await expect(service.approvePhoto('x' as any)).rejects.toThrow('photoId inválido.');
  });

  it('approvePhoto should reject missing photo', async () => {
    galleryPhotoRepo.findOne.mockResolvedValue(null);

    await expect(service.approvePhoto(77)).rejects.toThrow('Foto com id 77 não encontrada');
  });

  it('approvePhoto should approve and reload accommodation', async () => {
    galleryPhotoRepo.findOne.mockResolvedValue({
      id: 7,
      place: { id: 10 },
      status: 'pending',
      approvedAt: null,
      rejectionReason: null,
    });
    galleryPhotoRepo.save.mockResolvedValue(undefined);
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: 10 } as any);

    const result = await service.approvePhoto(7);

    expect(galleryPhotoRepo.save).toHaveBeenCalled();
    expect(result).toEqual({ id: 10 });
  });

  it('rejectPhoto should reject invalid photo id', async () => {
    await expect(service.rejectPhoto('x' as any)).rejects.toThrow('photoId inválido.');
  });

  it('rejectPhoto should reject missing photo', async () => {
    galleryPhotoRepo.findOne.mockResolvedValue(null);

    await expect(service.rejectPhoto(88)).rejects.toThrow('Foto com id 88 não encontrada');
  });

  it('rejectPhoto should reject and reload accommodation', async () => {
    galleryPhotoRepo.findOne.mockResolvedValue({
      id: 8,
      place: { id: 11 },
      status: 'pending',
      approvedAt: null,
      rejectionReason: null,
    });
    galleryPhotoRepo.save.mockResolvedValue(undefined);
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: 11 } as any);

    const result = await service.rejectPhoto(8, 'not allowed');

    expect(galleryPhotoRepo.save).toHaveBeenCalled();
    expect(result).toEqual({ id: 11 });
  });

  it('getPendingPhotosForAccommodation should reject invalid place id', async () => {
    await expect(service.getPendingPhotosForAccommodation('x' as any)).rejects.toThrow('placeId inválido.');
  });

  it('getPendingPhotosForAccommodation should reject missing accommodation', async () => {
    placeRepo.findOne.mockResolvedValue(null);

    await expect(service.getPendingPhotosForAccommodation(123)).rejects.toThrow('Accommodation com id 123 não encontrado');
  });

  it('getPendingPhotosForAccommodation should return accommodation with only pending photos', async () => {
    placeRepo.findOne.mockResolvedValue({
      id: 10,
      gallery_photos: [
        { id: 1, status: 'pending' },
        { id: 2, status: 'approved' },
      ],
      account: { id: 5, name: 'Host' },
    });
    jest.spyOn(service as any, 'attachServices').mockResolvedValue(undefined);

    const result = await service.getPendingPhotosForAccommodation(10);

    expect((result as any).ownerId).toBe(5);
  });

  it('rejectRemovalRequest should reject missing request', async () => {
    removalRequestRepo.findOne.mockResolvedValue(null);

    await expect(service.rejectRemovalRequest(99)).rejects.toThrow('Pedido de remoção com id 99 não encontrado');
  });

  it('getRemovalRequestsByAccount should map pending requests', async () => {
    const qb = createQueryBuilderMock([
      {
        id: 3,
        placeId: 10,
        accountId: 5,
        placeName: 'Place',
        requesterName: 'Host',
        requesterEmail: 'host@example.com',
        reason: 'Delete',
        status: 'pending',
        rejectionReason: null,
        createdAt: new Date(),
        reviewedAt: null,
      },
    ]);
    removalRequestRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getRemovalRequestsByAccount(5);

    expect(result[0]).toEqual(expect.objectContaining({ id: 3, status: 'pending' }));
  });

  it('getPendingEditRequests should map requests', async () => {
    editRequestRepo.find.mockResolvedValue([
      {
        id: 1,
        placeId: 10,
        accountId: 5,
        requesterName: 'Host',
        requesterEmail: 'host@example.com',
        payload: { place_name: 'New' },
        status: 'pending',
        rejectionReason: null,
        createdAt: new Date(),
        reviewedAt: null,
      },
    ]);

    const result = await service.getPendingEditRequests();

    expect(result[0]).toEqual(expect.objectContaining({ id: 1, status: 'pending' }));
  });

  it('approveEditRequest should reject missing request', async () => {
    editRequestRepo.findOne.mockResolvedValue(null);

    await expect(service.approveEditRequest(123)).rejects.toThrow('Edit request com id 123 não encontrado');
  });

  it('approveEditRequest should reject invalid payload request', async () => {
    editRequestRepo.findOne.mockResolvedValue({
      id: 1,
      placeId: null,
      accountId: null,
      requesterName: null,
      requesterEmail: null,
      payload: null,
      status: 'pending',
      rejectionReason: null,
      createdAt: new Date(),
      reviewedAt: null,
      place: null,
      account: null,
    });
    editRequestRepo.save.mockResolvedValue({
      id: 1,
      placeId: null,
      accountId: null,
      requesterName: null,
      requesterEmail: null,
      payload: null,
      status: 'rejected',
      rejectionReason: 'Pedido inválido ou sem payload.',
      createdAt: new Date(),
      reviewedAt: new Date(),
      place: null,
      account: null,
    });

    const result = await service.approveEditRequest(1);

    expect(result).toEqual(expect.objectContaining({ status: 'rejected', rejectionReason: 'Pedido inválido ou sem payload.' }));
  });

  it('rejectEditRequest should reject existing request', async () => {
    editRequestRepo.findOne.mockResolvedValue({
      id: 3,
      placeId: 10,
      accountId: 5,
      requesterName: 'Host',
      requesterEmail: 'host@example.com',
      payload: { place_name: 'New' },
      status: 'pending',
      rejectionReason: null,
      createdAt: new Date(),
      reviewedAt: null,
      place: { id: 10 },
      account: { id: 5 },
    });
    editRequestRepo.save.mockResolvedValue({
      id: 3,
      placeId: 10,
      accountId: 5,
      requesterName: 'Host',
      requesterEmail: 'host@example.com',
      payload: { place_name: 'New' },
      status: 'rejected',
      rejectionReason: 'Nope',
      createdAt: new Date(),
      reviewedAt: new Date(),
      place: { id: 10 },
      account: { id: 5 },
    });

    const result = await service.rejectEditRequest(3, 'Nope');

    expect(result).toEqual(expect.objectContaining({ id: 3, status: 'rejected' }));
  });
});
