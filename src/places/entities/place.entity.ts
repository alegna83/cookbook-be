import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Camino } from '../../caminos/entities/camino.entity';
import { Stage } from '../../stages/entities/stage.entity';
import { GalleryPhoto } from '../../gallery/entities/gallery-photo.entity';
import { PlaceCategory } from '../../place-categories/entities/place-category.entity';
import { PlacePrice } from 'src/place-prices/entities/place-price.entity';

@Entity('places')
export class Place {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  place_name: string;

  @ManyToOne(() => Camino, camino => camino.places, { eager: true })
  @JoinColumn({ name: 'camino_id' })
  camino: Camino;

  @ManyToOne(() => Stage, stage => stage.places, { eager: true })
  @JoinColumn({ name: 'stage_id' })
  stage: Stage;

  @ManyToOne(() => PlaceCategory, { eager: true })
  @JoinColumn({ name: 'place_category_id' })
  place_category: PlaceCategory;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  region: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  link: string;

  @Column({ nullable: true })
  reservation_link: string;

  @Column({ nullable: true })
  location_help: string;

  @Column({ nullable: true })
  pilgrim_exclusive: string;

  @Column({ nullable: true })
  allow_reservation: string;

  @Column({ nullable: true })
  dates_open: string;

  @Column({ nullable: true })
  time_open: string;

  @Column({ nullable: true })
  time_checkin: string;

  @Column({ nullable: true })
  time_checkout: string;

  @Column({ nullable: true })
  place_room_notes: string;

  @Column({ nullable: true })
  place_observations: string;

  @Column({ nullable: true })
  place_created_date: string;

  @Column({ nullable: true })
  place_management: string;

  @Column({ nullable: true })
  place_manager: string;

  @Column({ nullable: true })
  main_photo: string;

  @Column('decimal', { nullable: true })
  latitude: number;

  @Column('decimal', { nullable: true })
  longitude: number;

  @OneToMany(() => GalleryPhoto, (photo) => photo.place, { cascade: true })
  gallery_photos: GalleryPhoto[];

  @OneToMany(() => PlacePrice, (price) => price.place)
  prices: PlacePrice[];
}
