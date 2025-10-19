ALTER TABLE "platforms" ADD COLUMN IF NOT EXISTS "external_id" integer;
ALTER TABLE "platforms" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'INTERNAL';
CREATE UNIQUE INDEX IF NOT EXISTS "platforms_external_id_unique" ON "platforms" ("external_id") WHERE "external_id" IS NOT NULL;

ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "external_id" integer;
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'INTERNAL';
CREATE UNIQUE INDEX IF NOT EXISTS "games_platform_external_unique" ON "games" ("platform_id", "external_id") WHERE "external_id" IS NOT NULL;

ALTER TABLE "consoles" ADD COLUMN IF NOT EXISTS "external_id" integer;
ALTER TABLE "consoles" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE "consoles" ADD COLUMN IF NOT EXISTS "platform_id" uuid REFERENCES "platforms"("id") ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "consoles_external_id_unique" ON "consoles" ("external_id") WHERE "external_id" IS NOT NULL;

ALTER TABLE "game_listings" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'INTERNAL';

ALTER TABLE "console_listings" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'INTERNAL';