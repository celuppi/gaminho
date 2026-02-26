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

async function existingIndex(tableName: string) {
    // Check if the table has an id column
    const res = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'id';
    `, [tableName]);
    
    return res.rows.length > 0;
}

async function fixTable(tableName: string) {
  try {
    const hasId = await existingIndex(tableName);
    if (!hasId) {
      console.log(`Table ${tableName} does not have an 'id' column. Skipping.`);
      return;
    }

    console.log(`Fixing table ${tableName}...`);
    
    // Drop the id column. This might fail if it's the only PK. 
    // Drizzle wants composite PK (cardId, labelId). 
    // If id is PK, we need to drop PK constraint first.
    
    // Find PK constraint name
    const pkRes = await client.query(`
        SELECT con.conname
        FROM pg_catalog.pg_constraint con
            INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
            INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
        WHERE nsp.nspname = 'public'
            AND rel.relname = $1
            AND con.contype = 'p';
    `, [tableName]);

    if (pkRes.rows.length > 0) {
        const pkName = pkRes.rows[0].conname;
        console.log(`Dropping constraint ${pkName} on ${tableName}...`);
        await client.query(`ALTER TABLE "${tableName}" DROP CONSTRAINT "${pkName}";`);
    }

    console.log(`Dropping column 'id' from ${tableName}...`);
    await client.query(`ALTER TABLE "${tableName}" DROP COLUMN "id";`);

    // We don't need to add the new PK here, drizzle-kit push will do it.
    console.log(`Successfully fixed ${tableName}.`);
  } catch (error) {
    console.error(`Error fixing ${tableName}:`, error);
  }
}

async function main() {
  try {
    await client.connect();
    console.log('Connected to database.');

    await fixTable('_card_labels');
    await fixTable('_card_workspace_members');

    console.log('Database fix completed. You can now run "npm run db:push".');
  } catch (error) {
    console.error('Script failed:', error);
  } finally {
    await client.end();
  }
}

main();
