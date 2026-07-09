import { Test, TestingModule } from '@nestjs/testing';
import { StatisticsCaminosController } from './statistics-caminos.controller';
import { StatisticsCaminosService } from './statistics-caminos.service';

describe('StatisticsCaminosController (unit)', () => {
  let controller: StatisticsCaminosController;
  let service: StatisticsCaminosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatisticsCaminosController],
      providers: [
        {
          provide: StatisticsCaminosService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findByCamino: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<StatisticsCaminosController>(StatisticsCaminosController);
    service = module.get<StatisticsCaminosService>(StatisticsCaminosService);
  });

  it('should delegate create to the service', async () => {
    const dto = {
      caminoId: 1,
      month: 7,
      year: 2024,
      month_index: 6,
      numberPilgrims: 42000,
    };
    const created = { id: 1, ...dto };
    jest.spyOn(service, 'create').mockResolvedValue(created as any);

    const result = await controller.create(dto as any);

    expect(result).toEqual(created);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should delegate findAll to the service', async () => {
    const stats = [{ id: 1 }];
    jest.spyOn(service, 'findAll').mockResolvedValue(stats as any);

    const result = await controller.findAll();

    expect(result).toEqual(stats);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('should delegate findByCamino to the service', async () => {
    const stats = [{ id: 1, caminoId: 1 }];
    jest.spyOn(service, 'findByCamino').mockResolvedValue(stats as any);

    const result = await controller.findByCamino('1' as any);

    expect(result).toEqual(stats);
    expect(service.findByCamino).toHaveBeenCalledWith('1');
  });
});