import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadService } from './upload.service';
import { ContentModerationService } from '../moderation/content-moderation.service';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

describe('UploadService (unit)', () => {
  const originalEnv = { ...process.env };

  let service: UploadService;
  let moderation: {
    moderateImageBuffers: jest.Mock;
    moderateImageUrls: jest.Mock;
  };

  const createModule = async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        { provide: ContentModerationService, useValue: moderation },
      ],
    }).compile();

    return module.get<UploadService>(UploadService);
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    moderation = {
      moderateImageBuffers: jest.fn(),
      moderateImageUrls: jest.fn(),
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should throw when Cloudinary is not configured', async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    service = await createModule();

    await expect(
      service.uploadImage({ mimetype: 'image/jpeg', size: 10, buffer: Buffer.from('x') }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('should configure Cloudinary from CLOUDINARY_URL', async () => {
    process.env = { ...originalEnv, CLOUDINARY_URL: 'cloudinary://key:secret@demo-cloud' };

    service = await createModule();

    expect(cloudinary.config).toHaveBeenCalledWith({
      cloud_name: 'demo-cloud',
      api_key: 'key',
      api_secret: 'secret',
    });
  });

  it('should return unknown upload error when Cloudinary callback has no result', async () => {
    service = await createModule();

    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((options, callback) => {
      callback(null, null);
      return { end: jest.fn() };
    });

    await expect(
      service.uploadImage({ mimetype: 'image/jpeg', size: 1000, buffer: Buffer.from('data') }),
    ).rejects.toThrow('Erro desconhecido no upload.');
  });

  it('should reject when file is missing', async () => {
    service = await createModule();

    await expect(service.uploadImage(null as any)).rejects.toThrow('Ficheiro não fornecido.');
  });

  it('should reject when file is not an image', async () => {
    service = await createModule();

    await expect(
      service.uploadImage({ mimetype: 'application/pdf', size: 10, buffer: Buffer.from('x') }),
    ).rejects.toThrow('Ficheiro deve ser uma imagem.');
  });

  it('should reject when file is larger than 5MB', async () => {
    service = await createModule();

    await expect(
      service.uploadImage({ mimetype: 'image/jpeg', size: 6 * 1024 * 1024, buffer: Buffer.from('x') }),
    ).rejects.toThrow('Ficheiro excede o tamanho máximo de 5MB.');
  });

  it('should upload image successfully', async () => {
    service = await createModule();

    const uploadStream = jest.fn((options, callback) => {
      callback(null, { secure_url: 'https://cdn/test.jpg', public_id: 'test/public' });
      return { end: jest.fn() };
    });
    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation(uploadStream);

    const result = await service.uploadImage({
      mimetype: 'image/jpeg',
      size: 1000,
      buffer: Buffer.from('data'),
    });

    expect(result).toEqual({ url: 'https://cdn/test.jpg', publicId: 'test/public' });
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalled();
  });

  it('should reject when Cloudinary upload fails', async () => {
    service = await createModule();

    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((options, callback) => {
      callback(new Error('upload failed'));
      return { end: jest.fn() };
    });

    await expect(
      service.uploadImage({ mimetype: 'image/jpeg', size: 1000, buffer: Buffer.from('data') }),
    ).rejects.toThrow('Erro no upload: upload failed');
  });

  it('should reject when too many files are uploaded', async () => {
    service = await createModule();

    await expect(service.uploadMultipleImages(new Array(11).fill({}))).rejects.toThrow(
      'Máximo de 10 ficheiros permitido.',
    );
  });

  it('should reject when no files are provided to uploadMultipleImages', async () => {
    service = await createModule();

    await expect(service.uploadMultipleImages([])).rejects.toThrow(
      'Nenhum ficheiro fornecido.',
    );
  });

  it('should reject main-photo when pre-moderation blocks the image', async () => {
    service = await createModule();
    moderation.moderateImageBuffers.mockResolvedValue({ decision: 'reject', reason: 'nsfw' });

    await expect(
      service.uploadMedia([
        { buffer: Buffer.from('x'), mimetype: 'image/jpeg', size: 10 },
      ], 'main-photo'),
    ).rejects.toThrow('nsfw');
  });

  it('should upload main photo successfully', async () => {
    service = await createModule();
    moderation.moderateImageBuffers.mockResolvedValue({ decision: 'allow' });
    moderation.moderateImageUrls.mockResolvedValue({ decision: 'allow' });

    jest.spyOn(service, 'uploadImage').mockResolvedValue({
      url: 'https://cdn/main.jpg',
      publicId: 'main/public',
    } as any);

    const result = await service.uploadMedia(
      [{ buffer: Buffer.from('x'), mimetype: 'image/jpeg', size: 10 }],
      'main-photo',
    );

    expect(result).toEqual({ url: 'https://cdn/main.jpg', publicId: 'main/public' });
  });

  it('should reject main-photo when post-moderation blocks the image', async () => {
    service = await createModule();
    moderation.moderateImageBuffers.mockResolvedValue({ decision: 'allow' });
    moderation.moderateImageUrls.mockResolvedValue({ decision: 'reject', reason: 'blocked' });

    jest.spyOn(service, 'uploadImage').mockResolvedValue({
      url: 'https://cdn/main.jpg',
      publicId: 'main/public',
    } as any);
    (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue(undefined);

    await expect(
      service.uploadMedia(
        [{ buffer: Buffer.from('x'), mimetype: 'image/jpeg', size: 10 }],
        'main-photo',
      ),
    ).rejects.toThrow('blocked');

    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('main/public', {
      resource_type: 'image',
      invalidate: true,
    });
  });

  it('should reject gallery upload when it exceeds max files', async () => {
    service = await createModule();

    await expect(
      service.uploadMedia(new Array(11).fill({ buffer: Buffer.from('x') }), 'gallery-photos'),
    ).rejects.toThrow('Máximo de 10 ficheiros permitido.');
  });

  it('should reject gallery upload when post-moderation blocks it', async () => {
    service = await createModule();
    moderation.moderateImageBuffers.mockResolvedValue({ decision: 'allow' });
    moderation.moderateImageUrls.mockResolvedValue({ decision: 'reject', reason: 'blocked' });

    jest.spyOn(service, 'uploadMultipleImages').mockResolvedValue([
      { url: 'https://cdn/1.jpg', publicId: 'one' },
    ] as any);
    (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue(undefined);

    await expect(
      service.uploadMedia([
        { buffer: Buffer.from('x') },
      ], 'gallery-photos'),
    ).rejects.toThrow('blocked');

    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('one', {
      resource_type: 'image',
      invalidate: true,
    });
  });

  it('should upload gallery photos successfully', async () => {
    service = await createModule();
    moderation.moderateImageBuffers.mockResolvedValue({ decision: 'allow' });
    moderation.moderateImageUrls.mockResolvedValue({ decision: 'allow' });

    jest.spyOn(service, 'uploadMultipleImages').mockResolvedValue([
      { url: 'https://cdn/1.jpg', publicId: 'one' },
      { url: 'https://cdn/2.jpg', publicId: 'two' },
    ] as any);

    const result = await service.uploadMedia([
      { buffer: Buffer.from('x') },
      { buffer: Buffer.from('y') },
    ] as any, 'gallery-photos');

    expect(result).toEqual({
      urls: ['https://cdn/1.jpg', 'https://cdn/2.jpg'],
      publicIds: ['one', 'two'],
    });
  });

  it('should upload avatar successfully', async () => {
    service = await createModule();
    moderation.moderateImageBuffers.mockResolvedValue({ decision: 'allow' });
    moderation.moderateImageUrls.mockResolvedValue({ decision: 'allow' });

    jest.spyOn(service, 'uploadImage').mockResolvedValue({
      url: 'https://cdn/avatar.jpg',
      publicId: 'avatar/public',
    } as any);

    const result = await service.uploadMedia(
      [{ buffer: Buffer.from('x'), mimetype: 'image/jpeg', size: 10 }],
      'avatar',
    );

    expect(result).toEqual({ url: 'https://cdn/avatar.jpg', publicId: 'avatar/public' });
  });

  it('should reject avatar when post-moderation blocks the image', async () => {
    service = await createModule();
    moderation.moderateImageBuffers.mockResolvedValue({ decision: 'allow' });
    moderation.moderateImageUrls.mockResolvedValue({ decision: 'reject', reason: 'blocked' });

    jest.spyOn(service, 'uploadImage').mockResolvedValue({
      url: 'https://cdn/avatar.jpg',
      publicId: 'avatar/public',
    } as any);
    (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue(undefined);

    await expect(
      service.uploadMedia(
        [{ buffer: Buffer.from('x'), mimetype: 'image/jpeg', size: 10 }],
        'avatar',
      ),
    ).rejects.toThrow('blocked');

    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('avatar/public', {
      resource_type: 'image',
      invalidate: true,
    });
  });

  it('should reject avatar upload when it receives more than one file', async () => {
    service = await createModule();

    await expect(
      service.uploadMedia([
        { buffer: Buffer.from('x') },
        { buffer: Buffer.from('y') },
      ] as any, 'avatar'),
    ).rejects.toThrow('Envie exatamente um ficheiro para o avatar.');
  });
});
