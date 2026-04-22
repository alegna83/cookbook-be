import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Accommodation } from '../../accommodations/entities/accommodation.entity';

@Entity('place_prices')
export class AccommodationPrice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  description: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  price: number;

  @ManyToOne(() => Accommodation, (place) => place.prices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'place_id' })
  place: Accommodation;
}
