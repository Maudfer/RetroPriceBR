import { pgEnum } from "drizzle-orm/pg-core";

export const conditionEnum = pgEnum("condition_enum", [
  "GRADED",
  "SEALED",
  "CIB",
  "LOOSE",
  "CIB_REPRO",
  "LOOSE_REPRO",
  "BOX_ONLY",
  "MANUAL_ONLY"
]);

export const sourceEnum = pgEnum("source_enum", [
  "LIVE",
  "WEB_MARKETPLACE",
  "STORE_PHYSICAL",
  "INDIVIDUAL"
]);

export const reportEnum = pgEnum("report_enum", ["LIKE", "DISLIKE", "FRAUD"]);

export const storeTypeEnum = pgEnum("store_type_enum", [
  "PHYSICAL_SHOP",
  "YOUTUBE_CHANNEL",
  "SHOPEE_SHOP",
  "MERCADOLIVRE_STORE",
  "OTHER"
]);

export const purchaseStatusEnum = pgEnum("purchase_status_enum", [
  "PENDING",
  "ACTIVE",
  "REJECTED"
]);

export const listingTypeEnum = pgEnum("listing_type_enum", ["GAME", "CONSOLE"]);

export const userRoleEnum = pgEnum("user_role_enum", [
  "USER",
  "VERIFIED_STORE",
  "CURATOR",
  "ADMIN"
]);

export const livestreamPlatformEnum = pgEnum("livestream_platform_enum", [
  "YOUTUBE",
  "TWITCH",
  "OTHER"
]);
