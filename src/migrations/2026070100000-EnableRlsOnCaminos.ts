import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableRlsOnCaminos2026070100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE IF EXISTS public."caminos" ENABLE ROW LEVEL SECURITY',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE IF EXISTS public."caminos" DISABLE ROW LEVEL SECURITY',
    );
  }
}