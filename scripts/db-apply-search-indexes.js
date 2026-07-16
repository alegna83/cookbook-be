require('dotenv').config();
const { Client } = require('pg');

function createClient() {
  const sslEnabled = process.env.DB_SSL !== 'false';
  const sslStrict = process.env.DB_SSL_STRICT === 'true';

  return new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: sslEnabled ? { rejectUnauthorized: sslStrict } : false,
  });
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = createClient();
  await client.connect();

  try {
    console.log('Applying search performance indexes (safe/idempotent)...');

    await client.query(
      'CREATE INDEX IF NOT EXISTS "IDX_places_status_latitude_longitude" ON public."places" ("status", "latitude", "longitude")',
    );

    await client.query(
      'CREATE INDEX IF NOT EXISTS "IDX_statistics_caminos_camino_id" ON public."statistics_caminos" ("camino_id")',
    );

    const migrationCheck = await client.query(
      `SELECT name FROM migrations WHERE name IN ($1, $2) ORDER BY name`,
      [
        'EnableRlsOnCaminos2026070100000',
        'AddSearchPerformanceIndexes2026070900000',
      ],
    );

    const applied = new Set(migrationCheck.rows.map((r) => r.name));
    if (!applied.has('AddSearchPerformanceIndexes2026070900000')) {
      console.warn(
        'Note: AddSearchPerformanceIndexes2026070900000 is still pending in migrations table. Indexes are now applied, but keep migration state in mind for future migration runs.',
      );
    }

    if (!applied.has('EnableRlsOnCaminos2026070100000')) {
      console.warn(
        'Note: EnableRlsOnCaminos2026070100000 is still pending. Review RLS policy impact before running full migration:run in production.',
      );
    }

    console.log('Indexes applied successfully.');
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error('Failed to apply search indexes:', error.message);
  process.exit(1);
});
