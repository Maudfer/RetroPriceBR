import { Client } from "pg";
export { createPool, createDrizzle } from "./lib/client.js";
export * as schema from "./schema/index.js";

export interface DatabaseConfig {
  url: string;
  maxConnections?: number;
}

export const parseDatabaseUrl = (url: string | undefined): DatabaseConfig => {
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  return { url };
};

export const createClient = (config: DatabaseConfig | string): Client => {
  const normalized = typeof config === "string" ? parseDatabaseUrl(config) : config;

  return new Client({
    connectionString: normalized.url,
    application_name: "retropricebr",
  });
};

export const withClient = async <T>(
  config: DatabaseConfig | string,
  handler: (client: Client) => Promise<T>
): Promise<T> => {
  const client = createClient(config);
  await client.connect();

  try {
    return await handler(client);
  } finally {
    await client.end();
  }
};

export { runMigrations } from "./lib/migration-runner.js";
export { runSeeds } from "./lib/seeder.js";
