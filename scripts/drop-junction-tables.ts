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

async function main() {
  try {
    await client.connect();
    console.log('Connected to database.');

    console.log('Dropping table _card_labels...');
    await client.query('DROP TABLE IF EXISTS "_card_labels" CASCADE;');

    console.log('Dropping table _card_workspace_members...');
    await client.query('DROP TABLE IF EXISTS "_card_workspace_members" CASCADE;');

    console.log('Tables dropped successfully.');
    console.log('Now run "npm run db:push" to recreate them correctly.');

  } catch (error) {
    console.error('Script failed:', error);
  } finally {
    await client.end();
  }
}

main();
