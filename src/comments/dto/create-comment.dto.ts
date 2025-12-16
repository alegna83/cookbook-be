import {
  IsInt,
  IsPositive,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCommentDto {
  @IsInt()
  @IsPositive()
  placeId: number;

  @IsInt()
  @IsPositive()
  accountId: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
