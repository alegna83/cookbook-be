import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGalleryPhotoUploaderMetadata2026050700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "gallery_photos" ADD COLUMN IF NOT EXISTS "account_id" integer',
    );
    await queryRunner.query(
      'ALTER TABLE "gallery_photos" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP NOT NULL DEFAULT now()',
    );
    await queryRunner.query(
      'ALTER TABLE "gallery_photos" ADD COLUMN IF NOT EXISTS "status" character varying(50) NOT NULL DEFAULT \'pending\'',
    );
    await queryRunner.query(
      'ALTER TABLE "gallery_photos" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP',
    );
    await queryRunner.query(
      'ALTER TABLE "gallery_photos" ADD COLUMN IF NOT EXISTS "rejectionReason" character varying(500)',
    );
    await queryRunner.query(
      'ALTER TABLE "gallery_photos" ADD CONSTRAINT "FK_gallery_photos_account_id" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE SET NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "gallery_photos" DROP CONSTRAINT IF EXISTS "FK_gallery_photos_account_id"',
    );
    await queryRunner.query('ALTER TABLE "gallery_photos" DROP COLUMN IF EXISTS "rejectionReason"');
    await queryRunner.query('ALTER TABLE "gallery_photos" DROP COLUMN IF EXISTS "approvedAt"');
    await queryRunner.query('ALTER TABLE "gallery_photos" DROP COLUMN IF EXISTS "status"');
    await queryRunner.query('ALTER TABLE "gallery_photos" DROP COLUMN IF EXISTS "created_at"');
    await queryRunner.query('ALTER TABLE "gallery_photos" DROP COLUMN IF EXISTS "account_id"');
  }
}