import { IsString, IsOptional } from 'class-validator';

export class ApproveAccommodationDto {
  @IsString()
  action: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
