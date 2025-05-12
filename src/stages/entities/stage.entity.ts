import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Camino } from 'src/caminos/entities/camino.entity';
import { Place } from 'src/places/entities/place.entity';

@Entity('stages')
export class Stage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @ManyToOne(() => Camino, { eager: true })
  @JoinColumn({ name: 'camino_id' })
  camino: Camino;

  @OneToMany(() => Place, (place) => place.stage)
  places: Place[];
}
