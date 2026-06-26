import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlaceEditRequests2026062200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "place_edit_requests" (
        "id" SERIAL PRIMARY KEY,
        "place_id" integer,
        "account_id" integer,
        "requester_name" character varying(255),
        "requester_email" character varying(255),
        "payload" json,
        "status" character varying(50) NOT NULL DEFAULT 'pending',
        "reviewed_at" timestamp,
        "rejection_reason" character varying(500),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_place_edit_request_place"
          FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_place_edit_request_account"
          FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE SET NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "place_edit_requests";`);
  }
}
