const { DataSource } = require('typeorm');
require('dotenv').config();

const sslEnabled = process.env.DB_SSL !== 'false';
const sslStrict = process.env.DB_SSL_STRICT === 'true';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: false,
  migrations: ['dist/migrations/*.js'],
  migrationsTableName: 'migrations',
  entities: ['dist/**/*.entity.js'],
  // sslDisabled => false | otherwise configure strictness
  ssl: sslEnabled ? { rejectUnauthorized: sslStrict } : false,
});

module.exports = { AppDataSource };
