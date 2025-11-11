import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Camino } from 'src/caminos/entities/camino.entity';

@Entity('statistics_caminos')
export class StatisticsCaminos {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Camino, (camino: Camino) => camino.statistics, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'camino_id' })
  camino: Camino;

  @Column({ name: 'camino_id', nullable: true })
  caminoId: number;

  @Column({ type: 'int', nullable: true })
  year: number;

  @Column({ type: 'int', nullable: true })
  month: number;

  @Column({ type: 'int', nullable: true })
  month_index: number; // 0 = mês atual, -1 = mês anterior, etc.

  @Column({ type: 'int', name: 'number_pilgrims', nullable: true })
  numberPilgrims: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
