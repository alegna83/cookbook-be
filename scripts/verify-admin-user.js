const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verifyAdminUser() {
  const client = await pool.connect();
  try {
    const email = 'admin@mail.pt';

    // Update to verify email and set password if needed
    const result = await client.query(
      `UPDATE account 
       SET "isEmailVerified" = true,
           password = $2
       WHERE email = $1
       RETURNING id, email, name, "isEmailVerified"`,
      [email, '$2b$10$UyAn/EFUwigk8WmPxFPC/edUHQLUE3haq34Qy4ghSVhXlqN.kd6yi']
    );

    if (result.rows.length > 0) {
      console.log('✓ Admin user updated:');
      console.log(`  Email: ${result.rows[0].email}`);
      console.log(`  Name: ${result.rows[0].name}`);
      console.log(`  Email Verified: ${result.rows[0].isEmailVerified}`);
      console.log(`\nLogin credentials:`);
      console.log(`  Email: admin@mail.pt`);
      console.log(`  Password: admin123`);
    } else {
      console.log('✗ User not found');
    }
  } catch (error) {
    console.error('✗ Error updating admin user:', error.message);
  } finally {
    await client.end();
    await pool.end();
  }
}

verifyAdminUser();
