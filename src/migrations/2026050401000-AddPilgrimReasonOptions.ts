import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPilgrimReasonOptions2026050401000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "account"
      ADD COLUMN IF NOT EXISTS "pilgrim_reason_other" text
    `);

    await queryRunner.query(`
      UPDATE "account"
      SET
        "pilgrim_reason" = CASE
          WHEN LOWER(TRIM("pilgrim_reason")) = 'motivos espirituais e religiosos' THEN 'Spiritual and Religious'
          WHEN LOWER(TRIM("pilgrim_reason")) = 'autoconhecimento e saúde mental' THEN 'Self-discovery and Mental Health'
          WHEN LOWER(TRIM("pilgrim_reason")) = 'autoconhecimento e saude mental' THEN 'Self-discovery and Mental Health'
          WHEN LOWER(TRIM("pilgrim_reason")) = 'superação e desafio físico' THEN 'Overcoming and Physical Challenge'
          WHEN LOWER(TRIM("pilgrim_reason")) = 'superacao e desafio fisico' THEN 'Overcoming and Physical Challenge'
          WHEN LOWER(TRIM("pilgrim_reason")) = 'cultura e natureza' THEN 'Culture and Nature'
          WHEN LOWER(TRIM("pilgrim_reason")) = 'socialização' THEN 'Socialization'
          WHEN LOWER(TRIM("pilgrim_reason")) = 'socializacao' THEN 'Socialization'
          WHEN TRIM("pilgrim_reason") IN (
            'Spiritual and Religious',
            'Self-discovery and Mental Health',
            'Overcoming and Physical Challenge',
            'Culture and Nature',
            'Socialization',
            'Other'
          ) THEN TRIM("pilgrim_reason")
          WHEN TRIM("pilgrim_reason") IS NULL OR TRIM("pilgrim_reason") = '' THEN NULL
          ELSE 'Other'
        END,
        "pilgrim_reason_other" = CASE
          WHEN LOWER(TRIM("pilgrim_reason")) IN (
            'motivos espirituais e religiosos',
            'autoconhecimento e saúde mental',
            'autoconhecimento e saude mental',
            'superação e desafio físico',
            'superacao e desafio fisico',
            'cultura e natureza',
            'socialização',
            'socializacao'
          ) THEN NULL
          WHEN TRIM("pilgrim_reason") IN (
            'Spiritual and Religious',
            'Self-discovery and Mental Health',
            'Overcoming and Physical Challenge',
            'Culture and Nature',
            'Socialization',
            'Other'
          ) THEN CASE
            WHEN TRIM("pilgrim_reason") = 'Other' THEN COALESCE(NULLIF(TRIM("pilgrim_reason_other"), ''), NULL)
            ELSE NULL
          END
          WHEN TRIM("pilgrim_reason") IS NULL OR TRIM("pilgrim_reason") = '' THEN NULL
          ELSE TRIM("pilgrim_reason")
        END
    `);

    await queryRunner.query(`
      ALTER TABLE "account"
      ADD CONSTRAINT "CHK_account_pilgrim_reason"
      CHECK (
        "pilgrim_reason" IS NULL OR "pilgrim_reason" IN (
          'Spiritual and Religious',
          'Self-discovery and Mental Health',
          'Overcoming and Physical Challenge',
          'Culture and Nature',
          'Socialization',
          'Other'
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "account" DROP CONSTRAINT IF EXISTS "CHK_account_pilgrim_reason"');
    await queryRunner.query('ALTER TABLE "account" DROP COLUMN IF EXISTS "pilgrim_reason_other"');
  }
}