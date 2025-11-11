import { IsInt, IsNotEmpty, Min, Max } from 'class-validator';

export class StatisticsCaminosDto {
  @IsInt()
  @IsNotEmpty()
  caminoId: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  year: number;

  @IsInt()
  month_index: number;

  @IsInt()
  @Min(0)
  numberPilgrims: number;
}
