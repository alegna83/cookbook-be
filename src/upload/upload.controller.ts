import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { UploadResponseDto, UploadMultipleResponseDto } from './dto/upload-response.dto';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('main-photo')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  async uploadMainPhoto(
    @UploadedFile() file: any,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Ficheiro não fornecido.');
    }
    return this.uploadService.uploadImage(file, 'accommodations/main');
  }

  @Post('gallery-photos')
  @HttpCode(200)
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadGalleryPhotos(
    @UploadedFiles() files: any[],
  ): Promise<UploadMultipleResponseDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Nenhum ficheiro fornecido.');
    }
    const uploadedFiles = await this.uploadService.uploadMultipleImages(
      files,
      'accommodations/gallery',
    );
    return { files: uploadedFiles };
  }
}
