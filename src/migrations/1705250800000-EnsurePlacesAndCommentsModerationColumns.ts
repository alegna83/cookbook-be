import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsurePlacesAndCommentsModerationColumns1705250800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "userType" varchar(50) DEFAULT 'normal'`,
    );

    await queryRunner.query(
      `ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "status" varchar(50) DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "approvedAt" timestamp NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "rejectionReason" varchar(500) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "account_id" int NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "status" varchar(50) DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "approvedAt" timestamp NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "rejectionReason" varchar(500) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "comments" DROP COLUMN IF EXISTS "rejectionReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP COLUMN IF EXISTS "approvedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP COLUMN IF EXISTS "status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "places" DROP COLUMN IF EXISTS "account_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "places" DROP COLUMN IF EXISTS "rejectionReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "places" DROP COLUMN IF EXISTS "approvedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "places" DROP COLUMN IF EXISTS "status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "account" DROP COLUMN IF EXISTS "userType"`,
    );
  }
}
