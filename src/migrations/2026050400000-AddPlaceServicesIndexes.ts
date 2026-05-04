import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlaceServicesIndexes2026050400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_place_services_place_id" ON "place_services" ("place_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_place_services_service_id" ON "place_services" ("service_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_place_services_service_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_place_services_place_id"');
  }
}