import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./packages/db/src/schema/index.ts",
  out: "./packages/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://app:app@localhost:5432/app"
  },
  verbose: true,
  strict: true
});
