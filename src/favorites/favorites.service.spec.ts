import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { Favorite } from './entities/favorite.entity';
import { Accommodation } from '../accommodations/entities/accommodation.entity';

describe('FavoritesService (unit)', () => {
  let service: FavoritesService;
  let favRepo: Repository<Favorite>;
  let placeRepo: Repository<Accommodation>;

  const mockFavorite: Favorite = {
    id: 1,
    placeId: 10,
    accountId: 5,
    createdAt: new Date(),
    place: undefined,
  };

  const mockAccommodation = {
    id: 10,
    placeId: 10,
    accountId: 1,
    latitude: 40.0,
    longitude: -5.0,
    description: 'A nice place',
    images: [],
    comments: [],
    favorites: [],
    account: undefined,
    caminoId: 1,
    camino: {} as any,
    categoryId: 1,
    category: undefined,
    prices: [],
    approved: true,
    moderationStatus: 'approved',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        {
          provide: getRepositoryToken(Favorite),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Accommodation),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
    favRepo = module.get<Repository<Favorite>>(getRepositoryToken(Favorite));
    placeRepo = module.get<Repository<Accommodation>>(getRepositoryToken(Accommodation));
  });

  describe('add', () => {
    it('should add a new favorite when place exists and is not already favorited', async () => {
      jest.spyOn(placeRepo, 'findOne').mockResolvedValue(mockAccommodation);
      jest.spyOn(favRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(favRepo, 'create').mockReturnValue(mockFavorite);
      jest.spyOn(favRepo, 'save').mockResolvedValue(mockFavorite);

      const result = await service.add({ placeId: 10, accountId: 5 });

      expect(result).toEqual(mockFavorite);
      expect(placeRepo.findOne).toHaveBeenCalledWith({ where: { id: 10 } });
      expect(favRepo.create).toHaveBeenCalledWith({ placeId: 10, accountId: 5 });
      expect(favRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when place does not exist', async () => {
      jest.spyOn(placeRepo, 'findOne').mockResolvedValue(null);

      await expect(service.add({ placeId: 999, accountId: 5 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return existing favorite when already favorited', async () => {
      jest.spyOn(placeRepo, 'findOne').mockResolvedValue(mockAccommodation);
      jest.spyOn(favRepo, 'findOne').mockResolvedValue(mockFavorite);

      const result = await service.add({ placeId: 10, accountId: 5 });

      expect(result).toEqual(mockFavorite);
      expect(favRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove a favorite when it exists and user is authorized', async () => {
      jest.spyOn(favRepo, 'findOne').mockResolvedValue(mockFavorite);
      jest.spyOn(favRepo, 'remove').mockResolvedValue(mockFavorite);

      await service.remove(1, 5);

      expect(favRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(favRepo.remove).toHaveBeenCalledWith(mockFavorite);
    });

    it('should throw NotFoundException when favorite does not exist', async () => {
      jest.spyOn(favRepo, 'findOne').mockResolvedValue(null);

      await expect(service.remove(999, 5)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user is not owner', async () => {
      jest.spyOn(favRepo, 'findOne').mockResolvedValue(mockFavorite);

      await expect(service.remove(1, 999)).rejects.toThrow(BadRequestException);
    });

    it('should allow removal without authorization check when accountId is not provided', async () => {
      jest.spyOn(favRepo, 'findOne').mockResolvedValue(mockFavorite);
      jest.spyOn(favRepo, 'remove').mockResolvedValue(mockFavorite);

      await service.remove(1);

      expect(favRepo.remove).toHaveBeenCalledWith(mockFavorite);
    });
  });

  describe('listByAccount', () => {
    it('should return list of favorites for an account ordered by createdAt DESC', async () => {
      const favorites = [mockFavorite];
      jest.spyOn(favRepo, 'find').mockResolvedValue(favorites);

      const result = await service.listByAccount(5);

      expect(result).toEqual(favorites);
      expect(favRepo.find).toHaveBeenCalledWith({
        where: { accountId: 5 },
        order: { createdAt: 'DESC' },
      });
    });

    it('should return empty array when account has no favorites', async () => {
      jest.spyOn(favRepo, 'find').mockResolvedValue([]);

      const result = await service.listByAccount(999);

      expect(result).toEqual([]);
    });
  });

  describe('exists', () => {
    it('should return true when favorite exists', async () => {
      jest.spyOn(favRepo, 'findOne').mockResolvedValue(mockFavorite);

      const result = await service.exists(5, 10);

      expect(result).toBe(true);
    });

    it('should return false when favorite does not exist', async () => {
      jest.spyOn(favRepo, 'findOne').mockResolvedValue(null);

      const result = await service.exists(5, 10);

      expect(result).toBe(false);
    });
  });

  describe('toggle', () => {
    it('should remove favorite when it already exists', async () => {
      jest.spyOn(favRepo, 'findOne').mockResolvedValue(mockFavorite);
      jest.spyOn(favRepo, 'remove').mockResolvedValue(mockFavorite);

      const result = await service.toggle(5, 10);

      expect(result).toEqual({ added: false });
      expect(favRepo.remove).toHaveBeenCalledWith(mockFavorite);
    });

    it('should add favorite when it does not exist', async () => {
      jest.spyOn(favRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(favRepo, 'create').mockReturnValue(mockFavorite);
      jest.spyOn(favRepo, 'save').mockResolvedValue(mockFavorite);

      const result = await service.toggle(5, 10);

      expect(result).toEqual({ added: true, favorite: mockFavorite });
      expect(favRepo.create).toHaveBeenCalledWith({ accountId: 5, placeId: 10 });
      expect(favRepo.save).toHaveBeenCalled();
    });
  });
});
