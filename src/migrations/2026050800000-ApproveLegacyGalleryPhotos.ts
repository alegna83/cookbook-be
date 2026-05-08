import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApproveLegacyGalleryPhotos2026050800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "gallery_photos"
        SET
          "status" = 'approved',
          "approvedAt" = COALESCE("approvedAt", CURRENT_TIMESTAMP),
          "rejectionReason" = NULL
        WHERE "account_id" IS NULL
      `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "gallery_photos"
        SET
          "status" = 'pending',
          "approvedAt" = NULL
        WHERE "account_id" IS NULL
      `,
    );
  }
}