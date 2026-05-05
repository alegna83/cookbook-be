import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  HttpCode,
  Body,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { UploadResponseDto, UploadMultipleResponseDto } from './dto/upload-response.dto';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor())
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
