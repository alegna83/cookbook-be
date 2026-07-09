import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CaminosController } from './caminos.controller';
import { CaminosService } from './caminos.service';

describe('CaminosController (unit)', () => {
  let controller: CaminosController;
  let service: CaminosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaminosController],
      providers: [
        {
          provide: CaminosService,
          useValue: {
            findAll: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CaminosController>(CaminosController);
    service = module.get<CaminosService>(CaminosService);
  });

  it('should delegate getAll to the service', async () => {
    const caminos = [{ id: 1, name: 'Camino Francés' }];
    jest.spyOn(service, 'findAll').mockResolvedValue(caminos as any);

    const result = await controller.handle({ action: 'getAll' });

    expect(result).toEqual(caminos);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('should throw BadRequestException for unknown action', async () => {
    await expect(controller.handle({ action: 'invalid' })).rejects.toThrow(
      BadRequestException,
    );
  });
});