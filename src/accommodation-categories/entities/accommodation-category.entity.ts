import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Accommodation } from 'src/accommodations/entities/accommodation.entity';

@Entity('place_categories')
export class AccommodationCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  // Relação inversa: uma categoria pode ter muitos places
  @OneToMany(() => Accommodation, (place) => place.place_category)
  places: Accommodation[];
}
