import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadMultipleResponseDto, UploadResponseDto } from './dto/upload-response.dto';
import { ContentModerationService } from 'src/moderation/content-moderation.service';

export type UploadType = 'main-photo' | 'gallery-photos' | 'avatar';

@Injectable()
export class UploadService {
  private readonly cloudinaryConfigured: boolean;

  constructor(private readonly moderationService: ContentModerationService) {
    const config = this.getCloudinaryConfigOrNull();
    this.cloudinaryConfigured = config !== null;

    if (config) {
      cloudinary.config(config);
    } else {
      console.warn(
        '[UploadService] Cloudinary is not configured yet. Uploads will fail until CLOUDINARY_* env vars or CLOUDINARY_URL are provided.',
      );
    }
  }

  private getCloudinaryConfigOrNull() {
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
      return null;
    }

    return {
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    };
  }

  private ensureCloudinaryConfigured() {
    if (this.cloudinaryConfigured) {
      return;
    }

    throw new InternalServerErrorException(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET, or provide CLOUDINARY_URL.',
    );
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
    console.log(`[UPLOAD] uploadImage() called for folder: ${folder}`);
    this.ensureCloudinaryConfigured();

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
            console.error('[UPLOAD] Upload error:', error.message);
            reject(
              new BadRequestException(
                `Erro no upload: ${error.message}`,
              ),
            );
          } else if (result) {
            console.log('[UPLOAD] Upload success, public_id:', result.public_id);
            console.log('[UPLOAD] Returning URL:', result.secure_url);
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
      const preModeration = await this.moderationService.moderateImageBuffers([
        file.buffer,
      ]);

      if (preModeration.decision === 'reject') {
        throw new BadRequestException(
          preModeration.reason || 'Image blocked by content moderation.',
        );
      }

      const uploaded = await this.uploadImage(file, 'accommodations/main');
      const moderation = await this.moderationService.moderateImageUrls([
        uploaded.url,
      ]);

      if (moderation.decision === 'reject') {
        await this.destroyUploadedFiles([uploaded.publicId]);
        throw new BadRequestException(
          moderation.reason || 'Image blocked by content moderation.',
        );
      }

      return uploaded;
    }

    if (type === 'avatar') {
      if (files.length !== 1) {
        throw new BadRequestException('Envie exatamente um ficheiro para o avatar.');
      }

      const [file] = files;
      const preModeration = await this.moderationService.moderateImageBuffers([
        file.buffer,
      ]);

      if (preModeration.decision === 'reject') {
        throw new BadRequestException(
          preModeration.reason || 'Image blocked by content moderation.',
        );
      }

      const uploaded = await this.uploadImage(file, 'accounts/avatars');
      const moderation = await this.moderationService.moderateImageUrls([
        uploaded.url,
      ]);

      if (moderation.decision === 'reject') {
        await this.destroyUploadedFiles([uploaded.publicId]);
        throw new BadRequestException(
          moderation.reason || 'Image blocked by content moderation.',
        );
      }

      return uploaded;
    }

    if (files.length > 10) {
      throw new BadRequestException('Máximo de 10 ficheiros permitido.');
    }

    const preModeration = await this.moderationService.moderateImageBuffers(
      files.map((file) => file.buffer),
    );

    if (preModeration.decision === 'reject') {
      throw new BadRequestException(
        preModeration.reason || 'Image blocked by content moderation.',
      );
    }

    const uploadedFiles = await this.uploadMultipleImages(
      files,
      'accommodations/gallery',
    );

    const moderation = await this.moderationService.moderateImageUrls(
      uploadedFiles.map((file) => file.url),
    );

    if (moderation.decision === 'reject') {
      await this.destroyUploadedFiles(
        uploadedFiles.map((file) => file.publicId),
      );
      throw new BadRequestException(
        moderation.reason || 'Image blocked by content moderation.',
      );
    }

    return {
      urls: uploadedFiles.map((file) => file.url),
      publicIds: uploadedFiles.map((file) => file.publicId),
    };
  }

  private async destroyUploadedFiles(publicIds: string[]): Promise<void> {
    const uniquePublicIds = [...new Set(publicIds.filter((id) => !!id))];

    for (const publicId of uniquePublicIds) {
      try {
        await cloudinary.uploader.destroy(publicId, {
          resource_type: 'image',
          invalidate: true,
        });
      } catch (error) {
        console.warn('[UPLOAD] Failed to delete moderated file:', publicId, error);
      }
    }
  }
}
