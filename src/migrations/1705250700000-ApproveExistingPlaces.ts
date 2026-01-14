import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApproveExistingPlaces1705250700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "places"
         SET "status" = 'approved',
             "approvedAt" = CURRENT_TIMESTAMP,
             "account_id" = 3
       WHERE "status" = 'pending' OR "status" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverte apenas os registos que ficaram marcados como approved com account_id = 3
    await queryRunner.query(
      `UPDATE "places"
         SET "status" = 'pending',
             "approvedAt" = NULL,
             "account_id" = NULL
       WHERE "status" = 'approved' AND "account_id" = 3`,
    );
  }
}
