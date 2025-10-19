import { drizzle } from "drizzle-orm/node-postgres";
import type { ClientConfig } from "pg";
import { Pool } from "pg";
import * as schema from "../schema/index.js";
import type { DatabaseConfig } from "../index.js";

export interface CreateDrizzleConfig extends Partial<DatabaseConfig> {
    poolConfig?: Omit<ClientConfig, "connectionString">;
}

export const createPool = (config: CreateDrizzleConfig = {}) => {
    const { url, poolConfig } = normalizeConfig(config);
    return new Pool({ connectionString: url, ...poolConfig });
};

export const createDrizzle = (config: CreateDrizzleConfig = {}) => {
    const pool = createPool(config);
    const db = drizzle(pool, { schema });
    return { db, pool };
};

const normalizeConfig = (config: CreateDrizzleConfig) => {
    if (!config.url && !process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required to create a database connection");
    }

    return {
        url: config.url ?? process.env.DATABASE_URL!,
        poolConfig: config.poolConfig
    };
};

export type Database = ReturnType<typeof createDrizzle>["db"];
