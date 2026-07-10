import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSearchPerformanceIndexes2026070900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_places_status_latitude_longitude" ON "places" ("status", "latitude", "longitude")',
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_statistics_caminos_camino_id" ON "statistics_caminos" ("camino_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_statistics_caminos_camino_id"',
    );

    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_places_status_latitude_longitude"',
    );
  }
}