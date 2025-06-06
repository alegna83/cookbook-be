import { Expose } from 'class-transformer';

export class PlacePriceDto {
  @Expose()
  id: number;

  @Expose()
  description: string;

  @Expose()
  price: number;
}
