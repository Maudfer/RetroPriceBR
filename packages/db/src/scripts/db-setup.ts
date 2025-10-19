import "dotenv/config";
import { runMigrations } from "../lib/migration-runner.js";
import { runSeeds } from "../lib/seeder.js";

const databaseUrl = process.env.DATABASE_URL;
const datasetDir = process.env.PLAYMYDATA_DIR;

if (!databaseUrl) {
  console.error("[db] DATABASE_URL is not set. Aborting setup.");
  process.exit(1);
}

const bootstrap = async (): Promise<void> => {
  await runMigrations(databaseUrl);
  await runSeeds(databaseUrl, { datasetDir });

  console.log("[db] database is ready for use");
};

bootstrap().catch((error) => {
  console.error("[db] setup command failed", error);
  process.exit(1);
});
