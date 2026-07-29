require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const ssl =
    process.env.DB_SSL !== 'false'
      ? { rejectUnauthorized: process.env.DB_SSL_STRICT === 'true' }
      : false;

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl,
  });

  await client.connect();

  try {
    const { rows } = await client.query(`
      WITH stats AS (
        SELECT
          (SELECT COUNT(*) FROM places) AS total_places,
          (SELECT COUNT(*) FROM places WHERE status = 'approved') AS approved_places,
          (SELECT COUNT(*) FROM comments) AS total_comments,
          (SELECT COUNT(*) FROM comments WHERE status = 'approved') AS approved_comments,
          (SELECT COUNT(*) FROM gallery_photos) AS total_gallery_photos,
          (SELECT COUNT(*) FROM account) AS total_accounts,
          (SELECT COUNT(*) FROM account WHERE "userType" = 'admin') AS admin_accounts,
          (SELECT COUNT(*) FROM account WHERE "userType" = 'normal') AS normal_accounts,
          (SELECT COUNT(*) FROM caminos) AS total_caminos,
          (SELECT COUNT(DISTINCT camino_id) FROM places WHERE camino_id IS NOT NULL) AS caminos_with_places
      )
      SELECT
        *,
        CASE
          WHEN total_comments = 0 THEN 0
          ELSE ROUND((approved_comments::numeric / total_comments::numeric) * 100, 2)
        END AS approved_comments_pct
      FROM stats;
    `);

    console.log(JSON.stringify(rows[0], null, 2));
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
