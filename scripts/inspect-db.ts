import { Client } from 'pg';

// Environment variables assumed to be loaded (e.g. via pnpm with-env)
const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('POSTGRES_URL is not defined in .env');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function inspectTable(tableName: string) {
  console.log(`\n--- Inspecting ${tableName} ---`);
  
  // Get columns
  const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = $1
      ORDER BY ordinal_position;
  `, [tableName]);
  
  console.log('Columns:', cols.rows);

  // Get constraints
  const cons = await client.query(`
      SELECT con.conname, con.contype, pg_get_constraintdef(con.oid) as def
      FROM pg_catalog.pg_constraint con
          INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
          INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
      WHERE nsp.nspname = 'public'
          AND rel.relname = $1;
  `, [tableName]);

  console.log('Constraints:', cons.rows);
}

async function main() {
  try {
    await client.connect();
    console.log('Connected to database.');

    await inspectTable('_card_labels');
    await inspectTable('_card_workspace_members');

  } catch (error) {
    console.error('Script failed:', error);
  } finally {
    await client.end();
  }
}

main();
