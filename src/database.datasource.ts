import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const databaseConfig: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: false,
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'migrations',
  entities: ['src/**/*.entity.ts'],
  // Configure SSL only when explicitly enabled via env var (DB_SSL). This
  // mirrors the logic in typeorm.config.js used for migrations.
  // DB_SSL should be 'false' to disable SSL in local/docker setups.
  ssl:
    process.env.DB_SSL !== 'false'
      ? ({ rejectUnauthorized: process.env.DB_SSL_STRICT === 'true' } as any)
      : false,
};

export const AppDataSource = new DataSource(databaseConfig);
