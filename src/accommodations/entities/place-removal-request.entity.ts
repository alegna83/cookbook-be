import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Accommodation } from './accommodation.entity';
import { Account } from 'src/accounts/account.entity';

@Entity('place_removal_requests')
export class PlaceRemovalRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'place_id', nullable: true })
  placeId: number | null;

  @Column({ name: 'account_id', nullable: true })
  accountId: number | null;

  @ManyToOne(() => Accommodation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'place_id' })
  place?: Accommodation | null;

  @ManyToOne(() => Account, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'account_id' })
  account?: Account | null;

  @Column({ name: 'place_name', type: 'varchar', length: 255, nullable: true })
  placeName: string | null;

  @Column({ name: 'requester_name', type: 'varchar', length: 255, nullable: true })
  requesterName: string | null;

  @Column({ name: 'requester_email', type: 'varchar', length: 255, nullable: true })
  requesterEmail: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'pending',
    comment: 'pending, approved, rejected',
  })
  status: 'pending' | 'approved' | 'rejected' = 'pending';

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 500, nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}