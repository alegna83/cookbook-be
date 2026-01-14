import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountUserTypeAndPlacesColumns1705250400000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add userType to account table
    await queryRunner.query(
      `ALTER TABLE "account" ADD COLUMN "userType" varchar(50) DEFAULT 'normal'`,
    );

    // Add status, approvedAt, rejectionReason, account_id to places table
    await queryRunner.query(
      `ALTER TABLE "places" ADD COLUMN "status" varchar(50) DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `ALTER TABLE "places" ADD COLUMN "approvedAt" timestamp NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "places" ADD COLUMN "rejectionReason" varchar(500) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "places" ADD COLUMN "account_id" int NULL`,
    );

    // Add status, approvedAt, rejectionReason to comments table
    await queryRunner.query(
      `ALTER TABLE "comments" ADD COLUMN "status" varchar(50) DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD COLUMN "approvedAt" timestamp NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD COLUMN "rejectionReason" varchar(500) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove userType from account
    await queryRunner.query(
      `ALTER TABLE "account" DROP COLUMN IF EXISTS "userType"`,
    );

    // Remove columns from places
    await queryRunner.query(
      `ALTER TABLE "places" DROP COLUMN IF EXISTS "status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "places" DROP COLUMN IF EXISTS "approvedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "places" DROP COLUMN IF EXISTS "rejectionReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "places" DROP COLUMN IF EXISTS "account_id"`,
    );

    // Remove columns from comments
    await queryRunner.query(
      `ALTER TABLE "comments" DROP COLUMN IF EXISTS "status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP COLUMN IF EXISTS "approvedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP COLUMN IF EXISTS "rejectionReason"`,
    );
  }
}
