import { Expose } from 'class-transformer';

export class AccommodationPriceDto {
  @Expose()
  id: number;

  @Expose()
  description: string;

  @Expose()
  price: number;
}
