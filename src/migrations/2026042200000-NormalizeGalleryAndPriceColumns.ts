import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeGalleryAndPriceColumns2026042200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'gallery_photos'
            AND column_name = 'placeId'
        ) THEN
          ALTER TABLE "gallery_photos" RENAME COLUMN "placeId" TO "place_id";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'gallery_photos'
            AND column_name = 'photoUrl'
        ) THEN
          ALTER TABLE "gallery_photos" RENAME COLUMN "photoUrl" TO "photo_url";
        ELSIF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'gallery_photos'
            AND column_name = 'url'
        ) THEN
          ALTER TABLE "gallery_photos" RENAME COLUMN "url" TO "photo_url";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'place_prices'
            AND column_name = 'placeId'
        ) THEN
          ALTER TABLE "place_prices" RENAME COLUMN "placeId" TO "place_id";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_gallery_photos_place_id"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_gallery_photos_placeId"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_place_prices_place_id"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_place_prices_placeId"',
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_gallery_photos_place_id" ON "gallery_photos" ("place_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_place_prices_place_id" ON "place_prices" ("place_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_place_prices_place_id"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_gallery_photos_place_id"',
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_gallery_photos_place_id" ON "gallery_photos" ("place_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_place_prices_place_id" ON "place_prices" ("place_id")',
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'place_prices'
            AND column_name = 'place_id'
        ) THEN
          ALTER TABLE "place_prices" RENAME COLUMN "place_id" TO "placeId";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'gallery_photos'
            AND column_name = 'photo_url'
        ) THEN
          ALTER TABLE "gallery_photos" RENAME COLUMN "photo_url" TO "url";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'gallery_photos'
            AND column_name = 'place_id'
        ) THEN
          ALTER TABLE "gallery_photos" RENAME COLUMN "place_id" TO "placeId";
        END IF;
      END
      $$;
    `);
  }
}
