// Quick migration: update existing subdomains from dot-separated to hyphen-separated
// e.g., "test.ishan" -> "test-ishan"

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const result = await pool.query('SELECT id, subdomain FROM apps');
  console.log('Current apps:', result.rows);
  
  for (const app of result.rows) {
    if (app.subdomain.includes('.')) {
      const newSub = app.subdomain.replace(/\./g, '-');
      console.log(`  Updating: ${app.subdomain} -> ${newSub}`);
      await pool.query('UPDATE apps SET subdomain = $1 WHERE id = $2', [newSub, app.id]);
    }
  }
  
  const after = await pool.query('SELECT id, subdomain FROM apps');
  console.log('After migration:', after.rows);
  
  await pool.end();
}

migrate().catch(console.error);
