import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1705240000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "account" (
        "id" SERIAL PRIMARY KEY,
        "email" character varying(255) NOT NULL UNIQUE,
        "password" character varying(255),
        "pilgrim_reason" character varying(255),
        "name" character varying(255),
        "userType" character varying(50) NOT NULL DEFAULT 'normal'
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "caminos" (
        "id" SERIAL PRIMARY KEY,
        "name" character varying,
        "ranking" integer,
        "is_popular" boolean NOT NULL DEFAULT false,
        "active" boolean NOT NULL DEFAULT true,
        "parent_camino_id" integer,
        CONSTRAINT "FK_72730ed8ef51fb893650f0512fa"
          FOREIGN KEY ("parent_camino_id") REFERENCES "caminos"("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stages" (
        "id" SERIAL PRIMARY KEY,
        "name" character varying,
        "camino_id" integer,
        CONSTRAINT "FK_1313a97d29667673d5a4a283977"
          FOREIGN KEY ("camino_id") REFERENCES "caminos"("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "place_categories" (
        "id" SERIAL PRIMARY KEY,
        "name" character varying
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "places" (
        "id" SERIAL PRIMARY KEY,
        "place_name" character varying,
        "address" character varying,
        "region" character varying,
        "phone" character varying,
        "email" character varying,
        "website" character varying,
        "link" character varying,
        "reservation_link" character varying,
        "location_help" character varying,
        "pilgrim_exclusive" character varying,
        "allow_reservation" character varying,
        "dates_open" character varying,
        "time_open" character varying,
        "time_checkin" character varying,
        "time_checkout" character varying,
        "place_room_notes" character varying,
        "place_observations" character varying,
        "place_created_date" character varying,
        "place_management" character varying,
        "place_manager" character varying,
        "main_photo" character varying,
        "latitude" numeric,
        "longitude" numeric,
        "services" text,
        "nearbyActivities" text,
        "status" character varying(50) NOT NULL DEFAULT 'pending',
        "account_id" integer,
        "approvedAt" timestamp,
        "rejectionReason" character varying(500),
        "camino_id" integer,
        "stage_id" integer,
        "place_category_id" integer,
        CONSTRAINT "FK_a1b09901594f4a16bc067e5ab55"
          FOREIGN KEY ("camino_id") REFERENCES "caminos"("id"),
        CONSTRAINT "FK_c8b30b924ea6f5f9a4ee4c60782"
          FOREIGN KEY ("stage_id") REFERENCES "stages"("id"),
        CONSTRAINT "FK_664f0588ae5ddf8bcf26879f0bf"
          FOREIGN KEY ("place_category_id") REFERENCES "place_categories"("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gallery_photos" (
        "id" SERIAL PRIMARY KEY,
        "url" character varying,
        "placeId" integer,
        CONSTRAINT "FK_f4652e22ab6ae3f75a626accb50"
          FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "place_prices" (
        "id" SERIAL PRIMARY KEY,
        "description" character varying NOT NULL,
        "price" numeric(10,2),
        "placeId" integer,
        CONSTRAINT "FK_facd70b9bee49ff1551dfd9236f"
          FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "comments" (
        "id" SERIAL PRIMARY KEY,
        "place_id" integer NOT NULL,
        "account_id" integer NOT NULL,
        "rating" numeric(2,1),
        "comment" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "status" character varying(50) NOT NULL DEFAULT 'pending',
        "approvedAt" timestamp,
        "rejectionReason" character varying(500),
        CONSTRAINT "FK_ca36bd1ca8ad51147abd22506f9"
          FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_53212c33f873f031f88ef8bbe29"
          FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "favorites" (
        "id" SERIAL PRIMARY KEY,
        "place_id" integer NOT NULL,
        "account_id" integer NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_ad9ef3900f0f27f4d9befb4b7ca"
          FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "statistics_caminos" (
        "id" SERIAL PRIMARY KEY,
        "camino_id" integer,
        "year" integer,
        "month" integer,
        "month_index" integer,
        "number_pilgrims" integer,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_2adb009608211188ff0c6e7353e"
          FOREIGN KEY ("camino_id") REFERENCES "caminos"("id") ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "statistics_caminos"');
    await queryRunner.query('DROP TABLE IF EXISTS "favorites"');
    await queryRunner.query('DROP TABLE IF EXISTS "comments"');
    await queryRunner.query('DROP TABLE IF EXISTS "place_prices"');
    await queryRunner.query('DROP TABLE IF EXISTS "gallery_photos"');
    await queryRunner.query('DROP TABLE IF EXISTS "places"');
    await queryRunner.query('DROP TABLE IF EXISTS "place_categories"');
    await queryRunner.query('DROP TABLE IF EXISTS "stages"');
    await queryRunner.query('DROP TABLE IF EXISTS "caminos"');
    await queryRunner.query('DROP TABLE IF EXISTS "account"');
  }
}
