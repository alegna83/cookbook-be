import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { StatisticsCaminosService } from './statistics-caminos.service';
import { StatisticsCaminos } from './entities/statistics-caminos.entity';

describe('StatisticsCaminosService (unit)', () => {
  let service: StatisticsCaminosService;
  let statsRepository: Repository<StatisticsCaminos>;

  const mockStatistics: StatisticsCaminos = {
    id: 1,
    year: 2024,
    month: 7,
    month_index: 6,
    numberPilgrims: 42000,
    caminoId: 1,
    camino: {} as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStatistics2: StatisticsCaminos = {
    id: 2,
    year: 2024,
    month: 6,
    month_index: 5,
    numberPilgrims: 38000,
    caminoId: 1,
    camino: {} as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticsCaminosService,
        {
          provide: getRepositoryToken(StatisticsCaminos),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StatisticsCaminosService>(StatisticsCaminosService);
    statsRepository = module.get<Repository<StatisticsCaminos>>(getRepositoryToken(StatisticsCaminos));
  });

  describe('create', () => {
    it('should create and save a new statistics record', async () => {
      const dto = {
        caminoId: 1,
        month: 7,
        year: 2024,
        month_index: 6, // 0-indexed
        numberPilgrims: 42000,
      };

      jest.spyOn(statsRepository, 'create').mockReturnValue(mockStatistics);
      jest.spyOn(statsRepository, 'save').mockResolvedValue(mockStatistics);

      const result = await service.create(dto);

      expect(result).toEqual(mockStatistics);
      expect(statsRepository.create).toHaveBeenCalledWith(dto);
      expect(statsRepository.save).toHaveBeenCalledWith(mockStatistics);
    });
  });

  describe('findAll', () => {
    it('should return all statistics ordered by year and month DESC', async () => {
      const statistics = [mockStatistics, mockStatistics2];
      jest.spyOn(statsRepository, 'find').mockResolvedValue(statistics);

      const result = await service.findAll();

      expect(result).toEqual(statistics);
      expect(statsRepository.find).toHaveBeenCalledWith({
        relations: ['camino'],
        order: { year: 'DESC', month: 'DESC' },
      });
    });

    it('should return empty array when no statistics exist', async () => {
      jest.spyOn(statsRepository, 'find').mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findByCamino', () => {
    it('should return statistics for a specific camino ordered by year and month DESC', async () => {
      const statistics = [mockStatistics, mockStatistics2];
      jest.spyOn(statsRepository, 'find').mockResolvedValue(statistics);

      const result = await service.findByCamino(1);

      expect(result).toEqual(statistics);
      expect(statsRepository.find).toHaveBeenCalledWith({
        where: { caminoId: 1 },
        order: { year: 'DESC', month: 'DESC' },
      });
    });

    it('should throw NotFoundException when camino has no statistics', async () => {
      jest.spyOn(statsRepository, 'find').mockResolvedValue([]);

      await expect(service.findByCamino(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with Portuguese message', async () => {
      jest.spyOn(statsRepository, 'find').mockResolvedValue([]);

      try {
        await service.findByCamino(999);
      } catch (error) {
        expect(error.message).toBe('Nenhuma estatística encontrada para este caminho');
      }
    });

    it('should handle multiple statistics records for same camino', async () => {
      const multipleStats = [mockStatistics, mockStatistics2];
      jest.spyOn(statsRepository, 'find').mockResolvedValue(multipleStats);

      const result = await service.findByCamino(1);

      expect(result.length).toBe(2);
      expect(result[0].year).toBe(2024);
      expect(result[0].month).toBe(7);
      expect(result[1].month).toBe(6);
    });
  });
});
