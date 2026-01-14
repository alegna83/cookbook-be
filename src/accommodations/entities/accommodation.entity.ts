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
import { AccommodationCategory } from '../../accommodation-categories/entities/accommodation-category.entity';
import { AccommodationPrice } from 'src/place-prices/entities/place-price.entity';

@Entity('places')
export class Accommodation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  place_name: string;

  @ManyToOne(() => Camino, (camino) => camino.places, { eager: true })
  @JoinColumn({ name: 'camino_id' })
  camino: Camino;

  @ManyToOne(() => Stage, (stage) => stage.places, { eager: true })
  @JoinColumn({ name: 'stage_id' })
  stage: Stage;

  @ManyToOne(() => AccommodationCategory, { eager: true })
  @JoinColumn({ name: 'place_category_id' })
  place_category: AccommodationCategory;

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

  @OneToMany(() => GalleryPhoto, (photo) => photo.place)
  gallery_photos: GalleryPhoto[];

  @OneToMany(() => AccommodationPrice, (price) => price.place)
  prices: AccommodationPrice[];

  @Column('simple-json', { nullable: true })
  services: string[];

  @Column('simple-json', { nullable: true })
  nearbyActivities: string[];

  @Column({
    type: 'varchar',
    length: 50,
    default: 'pending',
    comment: 'pending, approved, rejected',
  })
  status: 'pending' | 'approved' | 'rejected' = 'pending';

  @Column({ nullable: true })
  account_id: number;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectionReason: string;
}
