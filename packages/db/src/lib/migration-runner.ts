import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

interface MigrationFile {
  name: string;
  sql: string;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(moduleDir, "..", "..", "migrations");

const loadMigrationFiles = (): MigrationFile[] => {
  const files = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql"));

  files.sort();

  return files.map((fileName) => ({
    name: fileName,
    sql: readFileSync(join(migrationsDir, fileName), "utf8"),
  }));
};

const ensureMigrationsTable = async (client: Client): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const fetchAppliedMigrations = async (client: Client): Promise<Set<string>> => {
  const result = await client.query<{ name: string }>(
    "SELECT name FROM schema_migrations ORDER BY executed_at ASC"
  );

  const names = result.rows.map((row: { name: string }) => row.name);

  return new Set(names);
};

export const runMigrations = async (databaseUrl: string): Promise<void> => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run migrations");
  }

  const client = new Client({ connectionString: databaseUrl, application_name: "retropricebr" });
  await client.connect();

  try {
    await ensureMigrationsTable(client);

    const appliedMigrations = await fetchAppliedMigrations(client);
    const migrations = loadMigrationFiles();

    for (const migration of migrations) {
      if (appliedMigrations.has(migration.name)) {
        continue;
      }

      console.log(`[db] applying migration ${migration.name}`);

      try {
        await client.query("BEGIN");
        await client.query(migration.sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [migration.name]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log("[db] migrations completed");
  } finally {
    await client.end();
  }
};
