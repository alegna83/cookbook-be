import { Test, TestingModule } from '@nestjs/testing';
import { StagesController } from './stages.controller';
import { StagesService } from './stages.service';

describe('StagesController (unit)', () => {
  let controller: StagesController;
  let service: StagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StagesController],
      providers: [
        {
          provide: StagesService,
          useValue: {
            findAll: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<StagesController>(StagesController);
    service = module.get<StagesService>(StagesService);
  });

  it('should delegate findAll to the service', async () => {
    const stages = [{ id: 1, name: 'Stage 1' }];
    jest.spyOn(service, 'findAll').mockResolvedValue(stages as any);

    const result = await controller.findAll();

    expect(result).toEqual(stages);
    expect(service.findAll).toHaveBeenCalled();
  });
});