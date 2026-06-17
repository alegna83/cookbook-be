import { Test, TestingModule } from '@nestjs/testing';
import { AccommodationsService } from './accommodations.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Accommodation } from './entities/accommodation.entity';
import { AccommodationCategory } from '../accommodation-categories/entities/accommodation-category.entity';
import { GalleryPhoto } from '../gallery/entities/gallery-photo.entity';
import { Account } from '../accounts/account.entity';
import { PlaceRemovalRequest } from './entities/place-removal-request.entity';
import { ContentModerationService } from '../moderation/content-moderation.service';
import { NotFoundException } from '@nestjs/common';

describe('AccommodationsService (unit)', () => {
  let service: AccommodationsService;
  let placeRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let accountRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    placeRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
    const categoryMock = {};
    const galleryMock = {};
    accountRepo = { findOne: jest.fn() };
    const removalMock = {};
    const moderationMock = { moderateImageUrls: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccommodationsService,
        { provide: getRepositoryToken(Accommodation), useValue: placeRepo },
        { provide: getRepositoryToken(AccommodationCategory), useValue: categoryMock },
        { provide: getRepositoryToken(GalleryPhoto), useValue: galleryMock },
        { provide: getRepositoryToken(Account), useValue: accountRepo },
        { provide: getRepositoryToken(PlaceRemovalRequest), useValue: removalMock },
        { provide: ContentModerationService, useValue: moderationMock },
      ],
    }).compile();

    service = module.get<AccommodationsService>(AccommodationsService);
  });

  it('create should throw when moderation rejects images', async () => {
    // @ts-ignore
    (service as any).moderationService = { moderateImageUrls: jest.fn().mockResolvedValue({ decision: 'reject', reason: 'blocked' }) };

    await expect(service.create({ gallery_photos: ['http://x/y.jpg'], place_category: null } as any)).rejects.toThrow();
  });

  it('findOne should throw when the accommodation does not exist', async () => {
    placeRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException);
  });
});
