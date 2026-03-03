import { MigrationInterface, QueryRunner } from 'typeorm';

export class RepairCoreModerationAndUserTypeSchema2026030301000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'account'
        ) THEN
          ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "userType" varchar(50);

          UPDATE "account"
             SET "userType" = 'normal'
           WHERE "userType" IS NULL
              OR "userType" = ''
              OR LOWER("userType") NOT IN ('normal', 'admin');

          ALTER TABLE "account" ALTER COLUMN "userType" SET DEFAULT 'normal';
          ALTER TABLE "account" ALTER COLUMN "userType" SET NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'places'
        ) THEN
          ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "status" varchar(50);
          ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "approvedAt" timestamp NULL;
          ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "rejectionReason" varchar(500) NULL;
          ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "account_id" int NULL;

          UPDATE "places"
             SET "status" = 'approved'
           WHERE "status" IS NULL;

          UPDATE "places"
             SET "status" = 'approved'
           WHERE LOWER("status") = 'active';

          UPDATE "places"
             SET "status" = 'rejected'
           WHERE LOWER("status") IN ('inactive', 'disabled');

          UPDATE "places"
             SET "status" = 'pending'
           WHERE "status" NOT IN ('pending', 'approved', 'rejected');

          UPDATE "places"
             SET "approvedAt" = COALESCE("approvedAt", CURRENT_TIMESTAMP)
           WHERE "status" = 'approved';

          ALTER TABLE "places" ALTER COLUMN "status" SET DEFAULT 'pending';
          ALTER TABLE "places" ALTER COLUMN "status" SET NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'comments'
        ) THEN
          ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "status" varchar(50);
          ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "approvedAt" timestamp NULL;
          ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "rejectionReason" varchar(500) NULL;

          UPDATE "comments"
             SET "status" = 'pending'
           WHERE "status" IS NULL;

          UPDATE "comments"
             SET "status" = 'approved'
           WHERE LOWER("status") = 'active';

          UPDATE "comments"
             SET "status" = 'rejected'
           WHERE LOWER("status") IN ('inactive', 'disabled');

          UPDATE "comments"
             SET "status" = 'pending'
           WHERE "status" NOT IN ('pending', 'approved', 'rejected');

          ALTER TABLE "comments" ALTER COLUMN "status" SET DEFAULT 'pending';
          ALTER TABLE "comments" ALTER COLUMN "status" SET NOT NULL;
        END IF;
      END
      $$;
    `);
  }

  public async down(): Promise<void> {
    // no-op: migration de reparação defensiva para ambientes com drift
  }
}
