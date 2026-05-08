import { Expose } from 'class-transformer';

export class GalleryPhotoDto {
  @Expose()
  id: number;

  @Expose()
  url: string;

  @Expose()
  status: 'pending' | 'approved' | 'rejected';

  @Expose()
  approvedAt?: Date | null;

  @Expose()
  rejectionReason?: string | null;
}