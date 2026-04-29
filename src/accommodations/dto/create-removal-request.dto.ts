import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateRemovalRequestDto {
  @IsNumber()
  placeId: number;

  @IsNumber()
  accountId: number;

  @IsOptional()
  @IsString()
  reason?: string;
}