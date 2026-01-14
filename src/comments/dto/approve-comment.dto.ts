import { IsString, IsOptional } from 'class-validator';

export class ApproveCommentDto {
  @IsString()
  action: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
