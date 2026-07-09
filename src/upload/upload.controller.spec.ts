import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { UploadResponseDto, UploadMultipleResponseDto } from './dto/upload-response.dto';

describe('UploadController (unit)', () => {
  let controller: UploadController;
  let uploadService: UploadService;

  const mockUploadResponse: UploadResponseDto = {
    url: 'https://res.cloudinary.com/test/image/upload/v1234567890/image.jpg',
    publicId: 'test/image',
  };

  const mockMultipleUploadResponse: UploadMultipleResponseDto = {
    urls: [
      'https://res.cloudinary.com/test/image/upload/v1234567890/image1.jpg',
      'https://res.cloudinary.com/test/image/upload/v1234567890/image2.jpg',
    ],
    publicIds: ['test/image1', 'test/image2'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        {
          provide: UploadService,
          useValue: {
            uploadMedia: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UploadController>(UploadController);
    uploadService = module.get<UploadService>(UploadService);
  });

  describe('uploadMedia', () => {
    it('should successfully upload a main photo', async () => {
      const mockFile = {
        fieldname: 'files',
        originalname: 'photo.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
        size: 50000,
      };

      jest.spyOn(uploadService, 'uploadMedia').mockResolvedValue(mockUploadResponse);

      const result = await controller.uploadMedia('main-photo', [mockFile]);

      expect(result).toEqual(mockUploadResponse);
      expect(uploadService.uploadMedia).toHaveBeenCalledWith([mockFile], 'main-photo');
    });

    it('should successfully upload multiple gallery photos', async () => {
      const mockFiles = [
        {
          fieldname: 'files',
          originalname: 'photo1.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('fake-image-data-1'),
          size: 50000,
        },
        {
          fieldname: 'files',
          originalname: 'photo2.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('fake-image-data-2'),
          size: 60000,
        },
      ];

      jest.spyOn(uploadService, 'uploadMedia').mockResolvedValue(mockMultipleUploadResponse);

      const result = await controller.uploadMedia('gallery-photos', mockFiles);

      expect(result).toEqual(mockMultipleUploadResponse);
      expect(uploadService.uploadMedia).toHaveBeenCalledWith(mockFiles, 'gallery-photos');
    });

    it('should successfully upload an avatar', async () => {
      const mockFile = {
        fieldname: 'files',
        originalname: 'avatar.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
        size: 30000,
      };

      jest.spyOn(uploadService, 'uploadMedia').mockResolvedValue(mockUploadResponse);

      const result = await controller.uploadMedia('avatar', [mockFile]);

      expect(result).toEqual(mockUploadResponse);
      expect(uploadService.uploadMedia).toHaveBeenCalledWith([mockFile], 'avatar');
    });

    it('should throw BadRequestException when type is not provided', async () => {
      const mockFile = {
        fieldname: 'files',
        originalname: 'photo.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
        size: 50000,
      };

      await expect(controller.uploadMedia(undefined as any, [mockFile])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when no files are provided', async () => {
      await expect(controller.uploadMedia('main-photo', [])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when files array is null', async () => {
      await expect(controller.uploadMedia('main-photo', null as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when files array is undefined', async () => {
      await expect(controller.uploadMedia('main-photo', undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delegate to uploadService with correct parameters', async () => {
      const mockFile = {
        fieldname: 'files',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('data'),
        size: 10000,
      };

      jest.spyOn(uploadService, 'uploadMedia').mockResolvedValue(mockUploadResponse);

      await controller.uploadMedia('main-photo', [mockFile]);

      expect(uploadService.uploadMedia).toHaveBeenCalledTimes(1);
      expect(uploadService.uploadMedia).toHaveBeenCalledWith([mockFile], 'main-photo');
    });
  });
});
