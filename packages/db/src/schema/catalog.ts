import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";
import { conditionEnum } from "./enums.js";

export const platforms = pgTable("platforms", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const games = pgTable("games", {
  id: uuid("id").defaultRandom().primaryKey(),
  platformId: uuid("platform_id")
    .notNull()
    .references(() => platforms.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  igdbSlug: text("igdb_slug"),
  releaseYear: integer("release_year"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const gameListings = pgTable("game_listings", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  condition: conditionEnum("condition_enum").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const gamePrices = pgTable("game_prices", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameListingId: uuid("game_listing_id")
    .notNull()
    .references(() => gameListings.id, { onDelete: "cascade" }),
  dateCalculated: timestamp("date_calculated", { mode: "date" }).notNull(),
  medianValueCents: integer("median_value_cents").notNull(),
  iqrCents: integer("iqr_cents").notNull(),
  confidenceScore: integer("confidence_score").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const consoles = pgTable("consoles", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  vendor: text("vendor"),
  sku: text("sku"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const consoleListings = pgTable("console_listings", {
  id: uuid("id").defaultRandom().primaryKey(),
  consoleId: uuid("console_id")
    .notNull()
    .references(() => consoles.id, { onDelete: "cascade" }),
  condition: conditionEnum("condition_enum").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const consolePrices = pgTable("console_prices", {
  id: uuid("id").defaultRandom().primaryKey(),
  consoleListingId: uuid("console_listing_id")
    .notNull()
    .references(() => consoleListings.id, { onDelete: "cascade" }),
  dateCalculated: timestamp("date_calculated", { mode: "date" }).notNull(),
  medianValueCents: integer("median_value_cents").notNull(),
  iqrCents: integer("iqr_cents").notNull(),
  confidenceScore: integer("confidence_score").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const listingSearchView = pgTable("listing_search", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  metadata: jsonb("metadata").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const priceAggregates = pgTable("price_aggregates", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingType: text("listing_type").notNull(),
  listingId: uuid("listing_id").notNull(),
  medianValueCents: integer("median_value_cents").notNull(),
  confidence: integer("confidence").notNull(),
  sampleSize: integer("sample_size").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata")
});

