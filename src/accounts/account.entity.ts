import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Accommodation } from 'src/accommodations/entities/accommodation.entity';

@Entity()
export class Account {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pilgrim_reason: string | null;

  @Column({ type: 'text', nullable: true })
  pilgrim_reason_other: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'normal',
    comment: 'normal ou admin',
  })
  userType: 'normal' | 'admin';

  @Column({ type: 'varchar', length: 1024, nullable: true })
  avatar: string | null;

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  emailVerificationToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationTokenExpiry: Date | null;

  @OneToMany(() => Accommodation, (place) => place.account)
  places?: Accommodation[];
}
