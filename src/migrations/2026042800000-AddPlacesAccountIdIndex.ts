import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlacesAccountIdIndex2026042800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_places_account_id" ON "places" ("account_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_places_account_id"');
  }
}