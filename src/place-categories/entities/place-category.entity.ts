import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Place } from 'src/places/entities/place.entity';

@Entity('place_categories')
export class PlaceCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  // Relação inversa: uma categoria pode ter muitos places
  @OneToMany(() => Place, (place) => place.place_category)
  places: Place[];
}
