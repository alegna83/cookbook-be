import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Accommodation } from '../../accommodations/entities/accommodation.entity';

@Entity('favorites')
export class Favorite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'place_id' })
  placeId: number;

  @Column({ name: 'account_id' })
  accountId: number;

  @ManyToOne(() => Accommodation, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'place_id' })
  place?: Accommodation;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}