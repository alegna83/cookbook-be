import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from './comments.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Comment } from './entities/comment.entity';
import { Accommodation } from '../accommodations/entities/accommodation.entity';
import { ContentModerationService } from '../moderation/content-moderation.service';

describe('CommentsService (unit)', () => {
  let service: CommentsService;

  beforeEach(async () => {
    const commentRepo = { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), remove: jest.fn() };
    const placeRepo = { findOne: jest.fn() };
    const moderation = { moderateComment: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: commentRepo },
        { provide: getRepositoryToken(Accommodation), useValue: placeRepo },
        { provide: ContentModerationService, useValue: moderation },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  it('add should throw when moderation rejects', async () => {
    // @ts-ignore
    (service as any).placeRepo = { findOne: jest.fn().mockResolvedValue({ id: 1 }) };
    // @ts-ignore
    (service as any).moderationService = { moderateComment: jest.fn().mockResolvedValue({ decision: 'reject', reason: 'bad' }) };

    await expect(service.add({ placeId: 1, comment: 'bad' } as any)).rejects.toThrow();
  });

  it('add should throw when place does not exist', async () => {
    // @ts-ignore
    (service as any).placeRepo = { findOne: jest.fn().mockResolvedValue(null) };

    await expect(service.add({ placeId: 999, comment: 'text' } as any)).rejects.toThrow('Place não encontrado');
  });
});
