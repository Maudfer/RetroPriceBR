import "dotenv/config";
import { runSeeds } from "../lib/seeder.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[db] DATABASE_URL is not set. Aborting seeding.");
  process.exit(1);
}

runSeeds(databaseUrl)
  .then(() => {
    console.log("[db] seed command finished successfully");
  })
  .catch((error) => {
    console.error("[db] seed command failed", error);
    process.exit(1);
  });
