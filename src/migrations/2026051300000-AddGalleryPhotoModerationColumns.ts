import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGalleryPhotoModerationColumns2026051300000
  implements MigrationInterface
{
  name = 'AddGalleryPhotoModerationColumns2026051300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "gallery_photos"
      ADD COLUMN IF NOT EXISTS "account_id" integer NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "gallery_photos"
      ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "gallery_photos"
      ADD COLUMN IF NOT EXISTS "status" varchar(50) NOT NULL DEFAULT 'pending'
    `);

    await queryRunner.query(`
      ALTER TABLE "gallery_photos"
      ADD COLUMN IF NOT EXISTS "approvedAt" timestamp NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "gallery_photos"
      ADD COLUMN IF NOT EXISTS "rejectionReason" varchar(500) NULL
    `);

    await queryRunner.query(`
      UPDATE "gallery_photos"
         SET "status" = 'approved'
       WHERE "approvedAt" IS NOT NULL AND ("status" IS NULL OR "status" = 'pending')
    `);

    await queryRunner.query(`
      UPDATE "gallery_photos"
         SET "status" = 'pending'
       WHERE "status" IS NULL OR "status" NOT IN ('pending', 'approved', 'rejected')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "gallery_photos" DROP COLUMN IF EXISTS "rejectionReason"
    `);

    await queryRunner.query(`
      ALTER TABLE "gallery_photos" DROP COLUMN IF EXISTS "approvedAt"
    `);

    await queryRunner.query(`
      ALTER TABLE "gallery_photos" DROP COLUMN IF EXISTS "status"
    `);

    await queryRunner.query(`
      ALTER TABLE "gallery_photos" DROP COLUMN IF EXISTS "created_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "gallery_photos" DROP COLUMN IF EXISTS "account_id"
    `);
  }
}
