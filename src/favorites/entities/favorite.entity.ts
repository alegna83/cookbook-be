import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Place } from '../../places/entities/place.entity'; // ajuste o caminho se necessário

@Entity('favorites')
export class Favorite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'place_id' })
  placeId: number;

  @Column({ name: 'account_id' })
  accountId: number;

  @ManyToOne(() => Place, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'place_id' })
  place?: Place;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}