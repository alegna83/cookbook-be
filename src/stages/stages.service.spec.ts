import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StagesService } from './stages.service';
import { Stage } from './entities/stage.entity';

describe('StagesService (unit)', () => {
  let service: StagesService;
  let stageRepository: Repository<Stage>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StagesService,
        {
          provide: getRepositoryToken(Stage),
          useValue: {
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StagesService>(StagesService);
    stageRepository = module.get<Repository<Stage>>(getRepositoryToken(Stage));
  });

  it('should return all stages', async () => {
    const stages = [{ id: 1, name: 'Stage 1' }];
    jest.spyOn(stageRepository, 'find').mockResolvedValue(stages as any);

    const result = await service.findAll();

    expect(result).toEqual(stages);
    expect(stageRepository.find).toHaveBeenCalled();
  });
});