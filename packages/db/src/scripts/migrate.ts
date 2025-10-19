import "dotenv/config";
import { runMigrations } from "../lib/migration-runner.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[db] DATABASE_URL is not set. Aborting migrations.");
  process.exit(1);
}

runMigrations(databaseUrl)
  .then(() => {
    console.log("[db] migration command finished successfully");
  })
  .catch((error) => {
    console.error("[db] migration command failed", error);
    process.exit(1);
  });
