import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import {
  conditionEnum,
  listingTypeEnum,
  purchaseStatusEnum,
  reportEnum,
  sourceEnum
} from "./enums.js";
import { consoleListings, gameListings } from "./catalog.js";
import { livestreams, stores, users } from "./people.js";

export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingType: listingTypeEnum("listing_type").notNull(),
    gameListingId: uuid("game_listing_id").references(() => gameListings.id, {
      onDelete: "set null"
    }),
    consoleListingId: uuid("console_listing_id").references(() => consoleListings.id, {
      onDelete: "set null"
    }),
    condition: conditionEnum("condition_enum").notNull(),
    priceCents: integer("price_cents").notNull(),
    soldAt: timestamp("sold_at", { withTimezone: true }).notNull(),
    submittedBy: uuid("submitted_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "set null" }),
    livestreamId: uuid("livestream_id").references(() => livestreams.id, {
      onDelete: "set null"
    }),
    source: sourceEnum("source_enum").notNull(),
    evidenceUrl: text("evidence_url"),
    evidenceThumbUrl: text("evidence_thumb_url"),
    evidencePhash: text("evidence_phash"),
    confidenceRaw: doublePrecision("confidence_raw").default(0).notNull(),
    status: purchaseStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    uniqueNaturalKey: uniqueIndex("purchases_natural_key").on(
      table.listingType,
      table.gameListingId,
      table.consoleListingId,
      table.storeId,
      table.source,
      table.soldAt,
      table.priceCents
    ),
    listingGuard: check(
      "purchases_listing_guard",
      sql`
        (listing_type = 'GAME' AND game_listing_id IS NOT NULL AND console_listing_id IS NULL)
        OR
        (listing_type = 'CONSOLE' AND console_listing_id IS NOT NULL AND game_listing_id IS NULL)
      `
    )
  })
);

export const purchaseReports = pgTable(
  "purchase_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportType: reportEnum("report_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    uniqueReporter: uniqueIndex("purchase_reports_unique_reporter").on(
      table.purchaseId,
      table.reporterId
    )
  })
);

export const purchaseConfidenceHistory = pgTable(
  "purchase_confidence_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    confidenceRaw: doublePrecision("confidence_raw").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  }
);
