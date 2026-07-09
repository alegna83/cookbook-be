import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaminosService } from './caminos.service';
import { Camino } from './entities/camino.entity';

describe('CaminosService (unit)', () => {
  let service: CaminosService;
  let caminoRepository: Repository<Camino>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaminosService,
        {
          provide: getRepositoryToken(Camino),
          useValue: {
            query: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CaminosService>(CaminosService);
    caminoRepository = module.get<Repository<Camino>>(getRepositoryToken(Camino));
  });

  it('should execute the ranking query and return caminos', async () => {
    const caminos = [{ id: 1, name: 'Camino Francés', ranking_score: 10 }];
    jest.spyOn(caminoRepository, 'query').mockResolvedValue(caminos as any);

    const result = await service.findAll();

    expect(result).toEqual(caminos);
    expect(caminoRepository.query).toHaveBeenCalledTimes(1);
    expect(String((caminoRepository.query as jest.Mock).mock.calls[0][0])).toContain('WITH stats AS');
    expect(String((caminoRepository.query as jest.Mock).mock.calls[0][0])).toContain('ORDER BY');
  });
});