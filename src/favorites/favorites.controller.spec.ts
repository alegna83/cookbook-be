import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

describe('FavoritesController (unit)', () => {
  let controller: FavoritesController;
  let service: FavoritesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavoritesController],
      providers: [
        {
          provide: FavoritesService,
          useValue: {
            listByAccount: jest.fn(),
            add: jest.fn(),
            remove: jest.fn(),
            exists: jest.fn(),
            toggle: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<FavoritesController>(FavoritesController);
    service = module.get<FavoritesService>(FavoritesService);
  });

  it('should list favorites for an account', async () => {
    const favorites = [{ id: 1, placeId: 10, accountId: 5 }];
    jest.spyOn(service, 'listByAccount').mockResolvedValue(favorites as any);

    const result = await controller.handle({
      action: 'list',
      payload: { accountId: 5 },
    });

    expect(result).toEqual(favorites);
    expect(service.listByAccount).toHaveBeenCalledWith(5);
  });

  it('should add a favorite', async () => {
    const added = { id: 1, placeId: 10, accountId: 5 };
    jest.spyOn(service, 'add').mockResolvedValue(added as any);

    const result = await controller.handle({
      action: 'add',
      payload: { placeId: 10, accountId: 5 },
    });

    expect(result).toEqual(added);
    expect(service.add).toHaveBeenCalledWith({ placeId: 10, accountId: 5 });
  });

  it('should remove a favorite and return ok true', async () => {
    jest.spyOn(service, 'remove').mockResolvedValue(undefined);

    const result = await controller.handle({
      action: 'remove',
      payload: { id: 1, accountId: 5 },
    });

    expect(result).toEqual({ ok: true });
    expect(service.remove).toHaveBeenCalledWith(1, 5);
  });

  it('should check if favorite exists', async () => {
    jest.spyOn(service, 'exists').mockResolvedValue(true);

    const result = await controller.handle({
      action: 'exists',
      payload: { placeId: 10, accountId: 5 },
    });

    expect(result).toEqual({ exists: true });
    expect(service.exists).toHaveBeenCalledWith(5, 10);
  });

  it('should toggle a favorite', async () => {
    const toggleResult = { added: true, favorite: { id: 1 } };
    jest.spyOn(service, 'toggle').mockResolvedValue(toggleResult as any);

    const result = await controller.handle({
      action: 'toggle',
      payload: { placeId: 10, accountId: 5 },
    });

    expect(result).toEqual(toggleResult);
    expect(service.toggle).toHaveBeenCalledWith(5, 10);
  });

  it('should throw when action is unknown', async () => {
    await expect(
      controller.handle({ action: 'unknown', payload: {} }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw when required payload is missing', async () => {
    await expect(
      controller.handle({ action: 'add', payload: { accountId: 5 } }),
    ).rejects.toThrow(BadRequestException);
  });
});