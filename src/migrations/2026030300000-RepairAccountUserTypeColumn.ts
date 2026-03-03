import { MigrationInterface, QueryRunner } from 'typeorm';

export class RepairAccountUserTypeColumn2026030300000
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
      END
      $$;
    `);
  }

  public async down(): Promise<void> {
    // no-op: migration de reparação para alinhar schema em produção
  }
}
