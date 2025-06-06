import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Place } from '../../places/entities/place.entity';

@Entity('place_prices')
export class PlacePrice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  description: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  price: number;

  @ManyToOne(() => Place, (place) => place.prices, { onDelete: 'CASCADE' })
  place: Place;
}
