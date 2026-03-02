import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApproveExistingPlaces1705250700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$
       BEGIN
         IF EXISTS (
           SELECT 1
           FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = 'places'
         ) THEN
           UPDATE "places"
              SET "status" = 'approved',
                  "approvedAt" = CURRENT_TIMESTAMP,
                  "account_id" = 3
            WHERE "status" = 'pending' OR "status" IS NULL;
         END IF;
       END
       $$`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverte apenas os registos que ficaram marcados como approved com account_id = 3
    await queryRunner.query(
      `DO $$
       BEGIN
         IF EXISTS (
           SELECT 1
           FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = 'places'
         ) THEN
           UPDATE "places"
              SET "status" = 'pending',
                  "approvedAt" = NULL,
                  "account_id" = NULL
            WHERE "status" = 'approved' AND "account_id" = 3;
         END IF;
       END
       $$`,
    );
  }
}
