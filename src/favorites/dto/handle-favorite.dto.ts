import { IsString, IsOptional, IsInt, IsObject } from 'class-validator';

export class HandleFavoriteDto {
  @IsString()
  action: string;

  @IsOptional()
  @IsInt()
  page?: number;

  @IsOptional()
  @IsInt()
  limit?: number;

  @IsOptional()
  @IsObject()
  payload?: any;
}