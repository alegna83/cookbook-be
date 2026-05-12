import { Expose, Transform } from 'class-transformer';

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

  @Expose()
  @Transform(({ obj }) => {
    const account = obj?.account;
    if (account?.id != null) {
      return Number(account.id);
    }

    const accountId = obj?.account_id ?? obj?.accountId ?? obj?.uploaderId;
    return accountId != null ? Number(accountId) : null;
  })
  uploaderId?: number | null;
}