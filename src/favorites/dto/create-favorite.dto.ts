import { IsInt, IsPositive } from 'class-validator';

export class CreateFavoriteDto {
  @IsInt()
  @IsPositive()
  placeId: number;

  @IsInt()
  @IsPositive()
  accountId: number;
}