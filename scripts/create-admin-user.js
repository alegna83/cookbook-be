const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createAdminUser() {
  const client = await pool.connect();
  try {
    // Hash: admin123
    const passwordHash = '$2b$10$UyAn/EFUwigk8WmPxFPC/edUHQLUE3haq34Qy4ghSVhXlqN.kd6yi';
    const email = 'admin@mail.pt';
    const name = 'Admin';

    // Check if user already exists
    const checkResult = await client.query(
      'SELECT id FROM account WHERE email = $1',
      [email]
    );

    if (checkResult.rows.length > 0) {
      console.log(`✓ User ${email} already exists (ID: ${checkResult.rows[0].id})`);
      return;
    }

    // Insert admin user
    const result = await client.query(
      `INSERT INTO account (
        email, 
        password, 
        name, 
        "isEmailVerified",
        "createdAt",
        "updatedAt"
      ) VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, email, "isEmailVerified"`,
      [email, passwordHash, name, true]
    );

    console.log('✓ Admin user created successfully:');
    console.log(`  Email: ${result.rows[0].email}`);
    console.log(`  ID: ${result.rows[0].id}`);
    console.log(`  Email Verified: ${result.rows[0].isEmailVerified}`);
    console.log(`\nPassword: admin123`);
  } catch (error) {
    console.error('✗ Error creating admin user:', error.message);
  } finally {
    await client.end();
    await pool.end();
  }
}

createAdminUser();
