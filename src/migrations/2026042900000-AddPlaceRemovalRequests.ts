import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlaceRemovalRequests2026042900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "place_removal_requests" (
        "id" SERIAL NOT NULL,
        "place_id" integer,
        "account_id" integer,
        "place_name" character varying(255),
        "requester_name" character varying(255),
        "requester_email" character varying(255),
        "reason" text,
        "status" character varying(50) NOT NULL DEFAULT 'pending',
        "reviewed_at" TIMESTAMP,
        "rejection_reason" character varying(500),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_place_removal_requests_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_place_removal_requests_status" ON "place_removal_requests" ("status")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_place_removal_requests_place_id" ON "place_removal_requests" ("place_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_place_removal_requests_account_id" ON "place_removal_requests" ("account_id")',
    );

    await queryRunner.query(`
      ALTER TABLE "place_removal_requests"
      ADD CONSTRAINT "FK_place_removal_requests_place_id"
      FOREIGN KEY ("place_id") REFERENCES "places"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "place_removal_requests"
      ADD CONSTRAINT "FK_place_removal_requests_account_id"
      FOREIGN KEY ("account_id") REFERENCES "account"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "place_removal_requests" DROP CONSTRAINT IF EXISTS "FK_place_removal_requests_account_id"`);
    await queryRunner.query(`ALTER TABLE "place_removal_requests" DROP CONSTRAINT IF EXISTS "FK_place_removal_requests_place_id"`);
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_place_removal_requests_account_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_place_removal_requests_place_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_place_removal_requests_status"');
    await queryRunner.query('DROP TABLE IF EXISTS "place_removal_requests"');
  }
}