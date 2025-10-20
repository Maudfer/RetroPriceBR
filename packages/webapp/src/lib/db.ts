import { createDrizzle } from "@retroprice/db";
import { getEnv } from "../config/env";

let cached:
    | {
        db: ReturnType<typeof createDrizzle>["db"];
        pool: ReturnType<typeof createDrizzle>["pool"];
    }
    | null = null;

const ensureConnection = () => {
    if (!cached) {
        cached = createDrizzle({ url: getEnv().DATABASE_URL });

        process.on("beforeExit", async () => {
            await cached?.pool.end();
        });
    }

    return cached;
};

export const getDb = () => ensureConnection().db;
export const getPool = () => ensureConnection().pool;
export { schema } from "@retroprice/db";
