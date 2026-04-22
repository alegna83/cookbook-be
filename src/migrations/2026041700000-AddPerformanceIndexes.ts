import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes2026041700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_places_status" ON "places" ("status")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_places_camino_id" ON "places" ("camino_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_places_stage_id" ON "places" ("stage_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_places_place_category_id" ON "places" ("place_category_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_places_latitude_longitude" ON "places" ("latitude", "longitude")',
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_gallery_photos_place_id" ON "gallery_photos" ("placeId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_place_prices_place_id" ON "place_prices" ("placeId")',
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_comments_status" ON "comments" ("status")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_comments_place_id" ON "comments" ("place_id")',
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_favorites_account_id" ON "favorites" ("account_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_favorites_place_id" ON "favorites" ("place_id")',
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_place_categories_name_lower_btrim" ON "place_categories" (LOWER(BTRIM("name")))',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_caminos_name_lower_btrim" ON "caminos" (LOWER(BTRIM("name")))',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_caminos_name_lower_btrim"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_place_categories_name_lower_btrim"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_favorites_place_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_favorites_account_id"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_comments_place_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_comments_status"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_place_prices_place_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_gallery_photos_place_id"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_places_latitude_longitude"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_places_place_category_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_places_stage_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_places_camino_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_places_status"');
  }
}
