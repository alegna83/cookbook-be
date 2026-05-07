import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Accommodation } from 'src/accommodations/entities/accommodation.entity';
import { Account } from 'src/accounts/account.entity';

@Entity('gallery_photos')
export class GalleryPhoto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'photo_url', nullable: true })
  url: string;

  @ManyToOne(() => Accommodation, (place) => place.gallery_photos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'place_id' })
  place: Accommodation;

  @ManyToOne(() => Account, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
