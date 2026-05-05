import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadMultipleResponseDto, UploadResponseDto } from './dto/upload-response.dto';

export type UploadType = 'main-photo' | 'gallery-photos' | 'avatar';

@Injectable()
export class UploadService {
  constructor() {
    cloudinary.config(this.resolveCloudinaryConfig());
  }

  private resolveCloudinaryConfig() {
    const cloudinaryUrl = process.env.CLOUDINARY_URL;
    if (cloudinaryUrl) {
      const parsed = this.parseCloudinaryUrl(cloudinaryUrl);
      if (parsed) {
        return parsed;
      }
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.replace(/^"|"$/g, '');
    const apiKey = process.env.CLOUDINARY_API_KEY?.replace(/^"|"$/g, '');
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.replace(/^"|"$/g, '');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new InternalServerErrorException(
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET, or provide CLOUDINARY_URL.',
      );
    }

    return {
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    };
  }

  private parseCloudinaryUrl(url: string) {
    const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);

    if (!match) {
      return null;
    }

    const [, apiKey, apiSecret, cloudName] = match;

    return {
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    };
  }

  async uploadImage(
    file: any,
    folder: string = 'accommodations',
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Ficheiro não fornecido.');
    }

    const mimeType = file.mimetype;
    if (!mimeType.startsWith('image/')) {
      throw new BadRequestException('Ficheiro deve ser uma imagem.');
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('Ficheiro excede o tamanho máximo de 5MB.');
    }

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: 'auto',
          quality: 'auto',
          fetch_format: 'auto',
        },
        (error: any, result: any) => {
          if (error) {
            reject(
              new BadRequestException(
                `Erro no upload: ${error.message}`,
              ),
            );
          } else if (result) {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
            });
          } else {
            reject(new BadRequestException('Erro desconhecido no upload.'));
          }
        },
      );

      stream.end(file.buffer);
    });
  }

  async uploadMultipleImages(
    files: any[],
    folder: string = 'accommodations/gallery',
  ): Promise<UploadResponseDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Nenhum ficheiro fornecido.');
    }

    const maxFiles = 10;
    if (files.length > maxFiles) {
      throw new BadRequestException(
        `Máximo de ${maxFiles} ficheiros permitido.`,
      );
    }

    const uploadPromises = files.map((file) =>
      this.uploadImage(file, folder),
    );

    return Promise.all(uploadPromises);
  }

  async uploadMedia(
    files: any[],
    type: UploadType,
  ): Promise<UploadResponseDto | UploadMultipleResponseDto> {
    if (type === 'main-photo') {
      if (files.length !== 1) {
        throw new BadRequestException('Envie exatamente um ficheiro para a foto principal.');
      }

      const [file] = files;
      return this.uploadImage(file, 'accommodations/main');
    }

    if (type === 'avatar') {
      if (files.length !== 1) {
        throw new BadRequestException('Envie exatamente um ficheiro para o avatar.');
      }

      const [file] = files;
      return this.uploadImage(file, 'accounts/avatars');
    }

    if (files.length > 10) {
      throw new BadRequestException('Máximo de 10 ficheiros permitido.');
    }

    const uploadedFiles = await this.uploadMultipleImages(
      files,
      'accommodations/gallery',
    );

    return { urls: uploadedFiles.map((file) => file.url) };
  }
}
