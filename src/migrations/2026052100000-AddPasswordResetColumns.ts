import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetColumns2026052100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "passwordResetToken" character varying(255)`);
    await queryRunner.query(`ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "passwordResetTokenExpiry" timestamp`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "account" DROP COLUMN IF EXISTS "passwordResetTokenExpiry"`);
    await queryRunner.query(`ALTER TABLE "account" DROP COLUMN IF EXISTS "passwordResetToken"`);
  }
}
