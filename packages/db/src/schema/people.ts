import {
    boolean,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uuid
} from "drizzle-orm/pg-core";
import { livestreamPlatformEnum, storeTypeEnum, userRoleEnum } from "./enums.js";

export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: text("display_name").notNull(),
    email: text("email").notNull().unique(),
    reputation: integer("reputation").notNull().default(0),
    isVerifiedStore: boolean("is_verified_store").notNull().default(false),
    googleId: text("google_id").unique(),
    avatarUrl: text("avatar_url"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    cpfHash: text("cpf_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const userRoles = pgTable("user_roles", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    grantedBy: uuid("granted_by")
        .references(() => users.id, { onDelete: "set null" }),
    note: text("note")
});

export const stores = pgTable("stores", {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: text("display_name").notNull(),
    storeType: storeTypeEnum("store_type_enum").notNull(),
    verifiedFlag: boolean("verified_flag").notNull().default(false),
    externalRefs: jsonb("external_refs"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const livestreams = pgTable("livestreams", {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
        .references(() => stores.id, { onDelete: "set null" }),
    platform: livestreamPlatformEnum("platform").notNull(),
    url: text("url").notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const reputationEvents = pgTable("reputation_events", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    actorId: uuid("actor_id")
        .references(() => users.id, { onDelete: "set null" })
});

export const userSessions = pgTable("user_sessions", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true })
});
