import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./dist/schema/index.js",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://app:app@localhost:5432/app"
  },
  verbose: true,
  strict: true
});
