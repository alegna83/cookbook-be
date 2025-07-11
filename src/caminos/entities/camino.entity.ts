import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Place } from 'src/places/entities/place.entity';

@Entity('caminos')
export class Camino {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  ranking: number;

  @OneToMany(() => Place, (place) => place.camino)
  places: Place[];
}