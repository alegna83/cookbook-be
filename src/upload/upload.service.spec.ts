import { Test, TestingModule } from '@nestjs/testing';
import { UploadService } from './upload.service';
import { ContentModerationService } from '../moderation/content-moderation.service';

describe('UploadService (unit)', () => {
  let service: UploadService;

  beforeEach(async () => {
    const moderation = { moderateImageBuffers: jest.fn(), moderateImageUrls: jest.fn() } as Partial<ContentModerationService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        { provide: ContentModerationService, useValue: moderation },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
  });

  it('uploadMedia should reject when pre-moderation rejects', async () => {
    // @ts-ignore
    (service as any).moderationService = { moderateImageBuffers: jest.fn().mockResolvedValue({ decision: 'reject', reason: 'nsfw' }) };

    const fakeFile = { buffer: Buffer.from('x') } as any;

    await expect(service.uploadMedia([fakeFile], 'main-photo')).rejects.toThrow();
  });
});
