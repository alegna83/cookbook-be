import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Camino } from 'src/caminos/entities/camino.entity';
import { Accommodation } from 'src/accommodations/entities/accommodation.entity';

@Entity('stages')
export class Stage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @ManyToOne(() => Camino, { eager: true })
  @JoinColumn({ name: 'camino_id' })
  camino: Camino;

  @OneToMany(() => Accommodation, (place) => place.stage)
  places: Accommodation[];
}
