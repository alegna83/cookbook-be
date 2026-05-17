import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerificationColumns2026051700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "isEmailVerified" boolean DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "emailVerificationToken" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "emailVerificationTokenExpiry" timestamp`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "account" DROP COLUMN IF EXISTS "emailVerificationTokenExpiry"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" DROP COLUMN IF EXISTS "emailVerificationToken"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" DROP COLUMN IF EXISTS "isEmailVerified"`,
    );
  }
}
