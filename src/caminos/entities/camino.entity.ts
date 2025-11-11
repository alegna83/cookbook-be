import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Place } from 'src/places/entities/place.entity';
import { StatisticsCaminos } from 'src/statistics-caminos/entities/statistics-caminos.entity';

@Entity('caminos')
export class Camino {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  ranking: number;

  @Column({ type: 'boolean', default: false })
  is_popular: boolean;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @ManyToOne(() => Camino, (camino) => camino.children, { nullable: true })
  @JoinColumn({ name: 'parent_camino_id' })
  parent_camino: Camino;

  @OneToMany(() => Camino, (camino) => camino.parent_camino)
  children: Camino[];

  @OneToMany(() => Place, (place) => place.camino)
  places: Place[];

  @OneToMany(() => StatisticsCaminos, (stat) => stat.camino)
  statistics: StatisticsCaminos[];
}
