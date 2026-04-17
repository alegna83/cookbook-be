require('dotenv').config();
const { Client } = require('pg');

const REQUIRED_COLUMNS = [
  { table: 'account', column: 'userType' },
  { table: 'places', column: 'status' },
  { table: 'places', column: 'approvedAt' },
  { table: 'places', column: 'rejectionReason' },
  { table: 'places', column: 'account_id' },
  { table: 'comments', column: 'status' },
  { table: 'comments', column: 'approvedAt' },
  { table: 'comments', column: 'rejectionReason' },
];

const REQUIRED_MIGRATIONS = [
  'RepairPlacesAndCommentsModerationSchema2026030200000',
  'RepairAccountUserTypeColumn2026030300000',
  'RepairCoreModerationAndUserTypeSchema2026030301000',
];

function createClient() {
  const sslEnabled = process.env.DB_SSL !== 'false';
  const sslStrict = process.env.DB_SSL_STRICT === 'true';

  return new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: sslEnabled ? { rejectUnauthorized: sslStrict } : false,
  });
}

async function missingColumns(client) {
  const values = REQUIRED_COLUMNS.map(({ table, column }) => `('${table}','${column}')`).join(',');
  const query = `
    WITH required(table_name, column_name) AS (
      VALUES ${values}
    )
    SELECT r.table_name, r.column_name
    FROM required r
    LEFT JOIN information_schema.columns c
      ON c.table_schema = 'public'
     AND c.table_name = r.table_name
     AND c.column_name = r.column_name
    WHERE c.column_name IS NULL
    ORDER BY r.table_name, r.column_name;
  `;

  const { rows } = await client.query(query);
  return rows;
}

async function missingMigrations(client) {
  const { rows } = await client.query('SELECT name FROM migrations');
  const executed = new Set(rows.map((row) => row.name));
  return REQUIRED_MIGRATIONS.filter((name) => !executed.has(name));
}

async function statusProblems(client) {
  const places = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE status IS NULL)::int AS null_status,
      COUNT(*) FILTER (
        WHERE status IS NOT NULL
          AND LOWER(status) NOT IN ('pending','approved','rejected')
      )::int AS invalid_status
    FROM places;
  `);

  const comments = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE status IS NULL)::int AS null_status,
      COUNT(*) FILTER (
        WHERE status IS NOT NULL
          AND LOWER(status) NOT IN ('pending','approved','rejected')
      )::int AS invalid_status
    FROM comments;
  `);

  return {
    places: places.rows[0],
    comments: comments.rows[0],
  };
}

async function userTypeProblems(client) {
  const { rows } = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE "userType" IS NULL)::int AS null_usertype,
      COUNT(*) FILTER (
        WHERE "userType" IS NOT NULL
          AND LOWER("userType") NOT IN ('normal','admin')
      )::int AS invalid_usertype
    FROM account;
  `);
  return rows[0];
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = createClient();
  await client.connect();

  try {
    const [missingCols, missingMigs, statuses, userType] = await Promise.all([
      missingColumns(client),
      missingMigrations(client),
      statusProblems(client),
      userTypeProblems(client),
    ]);

    let ok = true;

    if (missingCols.length > 0) {
      ok = false;
      console.error('❌ Missing required columns:');
      missingCols.forEach((row) => {
        console.error(`   - ${row.table_name}.${row.column_name}`);
      });
    } else {
      console.log('✅ Required columns: OK');
    }

    if (missingMigs.length > 0) {
      ok = false;
      console.error('❌ Missing required migrations:');
      missingMigs.forEach((name) => {
        console.error(`   - ${name}`);
      });
    } else {
      console.log('✅ Required migrations: OK');
    }

    const placeNull = Number(statuses.places.null_status || 0);
    const placeInvalid = Number(statuses.places.invalid_status || 0);
    if (placeNull > 0 || placeInvalid > 0) {
      ok = false;
      console.error(`❌ Places status issues: null=${placeNull}, invalid=${placeInvalid}`);
    } else {
      console.log('✅ Places status values: OK');
    }

    const commentNull = Number(statuses.comments.null_status || 0);
    const commentInvalid = Number(statuses.comments.invalid_status || 0);
    if (commentNull > 0 || commentInvalid > 0) {
      ok = false;
      console.error(`❌ Comments status issues: null=${commentNull}, invalid=${commentInvalid}`);
    } else {
      console.log('✅ Comments status values: OK');
    }

    const userTypeNull = Number(userType.null_usertype || 0);
    const userTypeInvalid = Number(userType.invalid_usertype || 0);
    if (userTypeNull > 0 || userTypeInvalid > 0) {
      ok = false;
      console.error(`❌ Account userType issues: null=${userTypeNull}, invalid=${userTypeInvalid}`);
    } else {
      console.log('✅ Account userType values: OK');
    }

    if (!ok) {
      process.exit(1);
    }

    console.log('\n✅ Database health check passed.');
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error('❌ db:health failed:', error.message);
  process.exit(1);
});
