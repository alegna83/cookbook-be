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
  ssl: {
    rejectUnauthorized: false,
  } as any,
};

export const AppDataSource = new DataSource(databaseConfig);
