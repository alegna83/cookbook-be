import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountAvatar2026043000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "avatar" character varying(1024)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "account" DROP COLUMN IF EXISTS "avatar"');
  }
}
