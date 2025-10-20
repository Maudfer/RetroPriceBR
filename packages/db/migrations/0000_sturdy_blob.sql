CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "public"."condition_enum" AS ENUM('GRADED', 'SEALED', 'CIB', 'LOOSE', 'CIB_REPRO', 'LOOSE_REPRO', 'BOX_ONLY', 'MANUAL_ONLY');
CREATE TYPE "public"."listing_type_enum" AS ENUM('GAME', 'CONSOLE');
CREATE TYPE "public"."livestream_platform_enum" AS ENUM('YOUTUBE', 'TWITCH', 'OTHER');
CREATE TYPE "public"."purchase_status_enum" AS ENUM('PENDING', 'ACTIVE', 'REJECTED');
CREATE TYPE "public"."report_enum" AS ENUM('LIKE', 'DISLIKE', 'FRAUD');
CREATE TYPE "public"."source_enum" AS ENUM('LIVE', 'WEB_MARKETPLACE', 'STORE_PHYSICAL', 'INDIVIDUAL');
CREATE TYPE "public"."store_type_enum" AS ENUM('PHYSICAL_SHOP', 'YOUTUBE_CHANNEL', 'SHOPEE_SHOP', 'MERCADOLIVRE_STORE', 'OTHER');
CREATE TYPE "public"."user_role_enum" AS ENUM('USER', 'VERIFIED_STORE', 'CURATOR', 'ADMIN');

CREATE TABLE "console_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"console_id" uuid NOT NULL,
	"condition_enum" "condition_enum" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "console_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"console_listing_id" uuid NOT NULL,
	"date_calculated" timestamp NOT NULL,
	"median_value_cents" integer NOT NULL,
	"iqr_cents" integer NOT NULL,
	"confidence_score" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "consoles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"vendor" text,
	"sku" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consoles_slug_unique" UNIQUE("slug")
);

CREATE TABLE "game_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"condition_enum" "condition_enum" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "game_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_listing_id" uuid NOT NULL,
	"date_calculated" timestamp NOT NULL,
	"median_value_cents" integer NOT NULL,
	"iqr_cents" integer NOT NULL,
	"confidence_score" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"igdb_slug" text,
	"release_year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_slug_unique" UNIQUE("slug")
);

CREATE TABLE "listing_search" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platforms_slug_unique" UNIQUE("slug")
);

CREATE TABLE "price_aggregates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_type" text NOT NULL,
	"listing_id" uuid NOT NULL,
	"median_value_cents" integer NOT NULL,
	"confidence" integer NOT NULL,
	"sample_size" integer NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);

CREATE TABLE "livestreams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid,
	"platform" "livestream_platform_enum" NOT NULL,
	"url" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "reputation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid
);

CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"store_type_enum" "store_type_enum" NOT NULL,
	"verified_flag" boolean DEFAULT false NOT NULL,
	"external_refs" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role_enum" NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" uuid,
	"note" text
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"reputation" integer DEFAULT 0 NOT NULL,
	"is_verified_store" boolean DEFAULT false NOT NULL,
	"cpf_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE "purchase_confidence_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"confidence_raw" double precision NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "purchase_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"report_type" "report_enum" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_type" "listing_type_enum" NOT NULL,
	"game_listing_id" uuid,
	"console_listing_id" uuid,
	"condition_enum" "condition_enum" NOT NULL,
	"price_cents" integer NOT NULL,
	"sold_at" timestamp with time zone NOT NULL,
	"submitted_by" uuid NOT NULL,
	"store_id" uuid,
	"livestream_id" uuid,
	"source_enum" "source_enum" NOT NULL,
	"evidence_url" text,
	"evidence_thumb_url" text,
	"evidence_phash" text,
	"confidence_raw" double precision DEFAULT 0 NOT NULL,
	"status" "purchase_status_enum" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchases_listing_guard" CHECK (
        (listing_type = 'GAME' AND game_listing_id IS NOT NULL AND console_listing_id IS NULL)
        OR
        (listing_type = 'CONSOLE' AND console_listing_id IS NOT NULL AND game_listing_id IS NULL)
      )
);

ALTER TABLE "console_listings" ADD CONSTRAINT "console_listings_console_id_consoles_id_fk" FOREIGN KEY ("console_id") REFERENCES "public"."consoles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "console_prices" ADD CONSTRAINT "console_prices_console_listing_id_console_listings_id_fk" FOREIGN KEY ("console_listing_id") REFERENCES "public"."console_listings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "game_listings" ADD CONSTRAINT "game_listings_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "game_prices" ADD CONSTRAINT "game_prices_game_listing_id_game_listings_id_fk" FOREIGN KEY ("game_listing_id") REFERENCES "public"."game_listings"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "games" ADD CONSTRAINT "games_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "livestreams" ADD CONSTRAINT "livestreams_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "reputation_events" ADD CONSTRAINT "reputation_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "reputation_events" ADD CONSTRAINT "reputation_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "purchase_confidence_history" ADD CONSTRAINT "purchase_confidence_history_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "purchase_reports" ADD CONSTRAINT "purchase_reports_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "purchase_reports" ADD CONSTRAINT "purchase_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_game_listing_id_game_listings_id_fk" FOREIGN KEY ("game_listing_id") REFERENCES "public"."game_listings"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_console_listing_id_console_listings_id_fk" FOREIGN KEY ("console_listing_id") REFERENCES "public"."console_listings"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_livestream_id_livestreams_id_fk" FOREIGN KEY ("livestream_id") REFERENCES "public"."livestreams"("id") ON DELETE set null ON UPDATE no action;
CREATE UNIQUE INDEX "purchase_reports_unique_reporter" ON "purchase_reports" USING btree ("purchase_id","reporter_id");
CREATE UNIQUE INDEX "purchases_natural_key" ON "purchases" USING btree ("listing_type","game_listing_id","console_listing_id","store_id","source_enum","sold_at","price_cents");
CREATE INDEX "listing_search_title_trgm_idx" ON "listing_search" USING gin ("title" gin_trgm_ops);