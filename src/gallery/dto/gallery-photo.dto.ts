import { Expose } from 'class-transformer';

export class GalleryPhotoDto {
  @Expose()
  id: number;

  @Expose()
  url: string;
}