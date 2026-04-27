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
    @Body('type') type: 'main-photo' | 'gallery-photos',
    @UploadedFiles() files: any[],
  ): Promise<UploadResponseDto | UploadMultipleResponseDto> {
    if (!type) {
      throw new BadRequestException('Tipo de upload não fornecido.');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('Nenhum ficheiro fornecido.');
    }

    return this.uploadService.uploadMedia(files, type);
  }
}
