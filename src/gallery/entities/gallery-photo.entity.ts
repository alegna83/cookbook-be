import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Accommodation } from 'src/accommodations/entities/accommodation.entity';

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
}
