import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  HttpCode,
  Body,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { UploadResponseDto, UploadMultipleResponseDto } from './dto/upload-response.dto';

const MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_FILES = 10;

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @Throttle({ burst: { limit: 10, ttl: 10_000 }, sustained: { limit: 120, ttl: 3_600_000 } })
  @HttpCode(200)
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
        files: MAX_UPLOAD_FILES,
      },
      fileFilter: (_req, file, callback) => {
        callback(null, file.mimetype?.startsWith('image/') ?? false);
      },
    }),
  )
  async uploadMedia(
    @Body('type') type: 'main-photo' | 'gallery-photos' | 'avatar',
    @UploadedFiles() files: any[],
  ): Promise<UploadResponseDto | UploadMultipleResponseDto> {
    console.log('[UPLOAD-CONTROLLER] uploadMedia() called with type:', type);
    console.log('[UPLOAD-CONTROLLER] Files count:', files ? files.length : 0);

    if (!type) {
      throw new BadRequestException('Tipo de upload não fornecido.');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('Nenhum ficheiro fornecido.');
    }

    const result = await this.uploadService.uploadMedia(files, type);
    console.log('[UPLOAD-CONTROLLER] Upload result:', result);
    return result;
  }
}
