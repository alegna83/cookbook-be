import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  //JoinColumn,
} from 'typeorm';
import { Place } from 'src/places/entities/place.entity';

@Entity('gallery_photos')
export class GalleryPhoto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  url: string;

  @ManyToOne(() => Place, (place) => place.gallery_photos)
  //@JoinColumn({ name: 'place_id' })
  place: Place;
}
