import { eq, inArray } from "drizzle-orm";
import { Client } from "pg";
import { createDrizzle } from "./client.js";
import {
  chunkArray,
  loadPlayMyDataDataset,
  PLAYMYDATA_LISTING_NOTE,
  PLAYMYDATA_SOURCE,
  type LoadPlayMyDataOptions
} from "./playmydata-loader.js";
import {
  consoleListings,
  consoles,
  gameListings,
  games,
  platforms
} from "../schema/catalog.js";
import { conditionEnum } from "../schema/enums.js";

interface SeedRecord {
  slug: string;
  title: string;
  currencyCode: string;
}

interface SeedOptions extends LoadPlayMyDataOptions { }

const defaultGuides: SeedRecord[] = [
  {
    slug: "super-famicom",
    title: "Super Famicom",
    currencyCode: "BRL"
  },
  {
    slug: "mega-drive",
    title: "Mega Drive",
    currencyCode: "BRL"
  },
  {
    slug: "n64",
    title: "Nintendo 64",
    currencyCode: "BRL"
  }
];

const DEFAULT_LISTING_CONDITION = "LOOSE" as (typeof conditionEnum.enumValues)[number];

const seedPriceGuides = async (databaseUrl: string): Promise<void> => {
  const client = new Client({ connectionString: databaseUrl, application_name: "retropricebr" });
  await client.connect();

  try {
    for (const guide of defaultGuides) {
      await client.query(
        `
          INSERT INTO price_guides (slug, title, currency_code)
          VALUES ($1, $2, $3)
          ON CONFLICT (slug) DO UPDATE SET
            title = EXCLUDED.title,
            currency_code = EXCLUDED.currency_code,
            updated_at = NOW()
        `,
        [guide.slug, guide.title, guide.currencyCode]
      );
    }

    console.log(`[db] seeded ${defaultGuides.length} price guides`);
  } finally {
    await client.end();
  }
};

const seedPlayMyData = async (databaseUrl: string, options: SeedOptions): Promise<void> => {
  const dataset = loadPlayMyDataDataset({ datasetDir: options.datasetDir });

  if (dataset.games.length === 0) {
    console.warn("[db] PlayMyData dataset is empty. Skipping ingestion.");
    return;
  }

  const { db, pool } = createDrizzle({ url: databaseUrl });

  try {
    await db.transaction(async (tx) => {
      await tx.delete(gameListings).where(eq(gameListings.source, PLAYMYDATA_SOURCE));
      await tx.delete(games).where(eq(games.source, PLAYMYDATA_SOURCE));
      await tx.delete(consoleListings).where(eq(consoleListings.source, PLAYMYDATA_SOURCE));
      await tx.delete(consoles).where(eq(consoles.source, PLAYMYDATA_SOURCE));
      await tx.delete(platforms).where(eq(platforms.source, PLAYMYDATA_SOURCE));

      for (const chunk of chunkArray(dataset.platforms, 500)) {
        await tx.insert(platforms).values(
          chunk.map((platform) => ({
            name: platform.name,
            slug: platform.slug,
            externalId: platform.externalId,
            source: PLAYMYDATA_SOURCE
          }))
        );
      }

      const platformRecords = await tx
        .select({ id: platforms.id, externalId: platforms.externalId })
        .from(platforms)
        .where(inArray(platforms.externalId, dataset.platforms.map((platform) => platform.externalId)));

      const platformIdMap = new Map<number, string>();
      for (const record of platformRecords) {
        if (record.externalId != null) {
          platformIdMap.set(record.externalId, record.id);
        }
      }

      const consolePayload = dataset.consoles
        .map((consoleItem) => {
          const platformId = platformIdMap.get(consoleItem.platformExternalId);
          if (!platformId) {
            return null;
          }

          return {
            title: consoleItem.title,
            slug: consoleItem.slug,
            vendor: consoleItem.vendor ?? null,
            sku: null,
            notes: null,
            externalId: consoleItem.externalId,
            source: PLAYMYDATA_SOURCE,
            platformId
          };
        })
        .filter((value): value is NonNullable<typeof value> => value !== null);

      const insertedConsoles: Array<{ id: string; externalId: number | null }> = [];
      for (const chunk of chunkArray(consolePayload, 500)) {
        if (chunk.length === 0) {
          continue;
        }

        const result = await tx
          .insert(consoles)
          .values(chunk)
          .returning({ id: consoles.id, externalId: consoles.externalId });
        insertedConsoles.push(...result);
      }

      const gamesPayload = dataset.games
        .map((game) => {
          const platformId = platformIdMap.get(game.platformExternalId);
          if (!platformId) {
            return null;
          }

          return {
            platformId,
            title: game.title,
            slug: game.slug,
            igdbSlug: null,
            externalId: game.externalId,
            source: PLAYMYDATA_SOURCE,
            releaseYear: game.releaseYear
          };
        })
        .filter((value): value is NonNullable<typeof value> => value !== null);

      const insertedGames: Array<{ id: string; externalId: number | null }> = [];
      for (const chunk of chunkArray(gamesPayload, 500)) {
        if (chunk.length === 0) {
          continue;
        }

        const result = await tx
          .insert(games)
          .values(chunk)
          .returning({ id: games.id, externalId: games.externalId });
        insertedGames.push(...result);
      }

      const gameListingsPayload = insertedGames.map((record) => ({
        gameId: record.id,
        condition: DEFAULT_LISTING_CONDITION,
        notes: PLAYMYDATA_LISTING_NOTE,
        source: PLAYMYDATA_SOURCE
      }));

      for (const chunk of chunkArray(gameListingsPayload, 500)) {
        if (chunk.length === 0) {
          continue;
        }

        await tx.insert(gameListings).values(chunk);
      }

      const consoleListingsPayload = insertedConsoles.map((record) => ({
        consoleId: record.id,
        condition: DEFAULT_LISTING_CONDITION,
        notes: PLAYMYDATA_LISTING_NOTE,
        source: PLAYMYDATA_SOURCE
      }));

      for (const chunk of chunkArray(consoleListingsPayload, 500)) {
        if (chunk.length === 0) {
          continue;
        }

        await tx.insert(consoleListings).values(chunk);
      }

      console.log(
        `[db] PlayMyData: ${dataset.platforms.length} platforms, ${dataset.consoles.length} consoles, ${dataset.games.length} games ingested`
      );
    });
  } finally {
    await pool.end();
  }
};

export const runSeeds = async (databaseUrl: string, options: SeedOptions = {}): Promise<void> => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to seed the database");
  }

  await seedPriceGuides(databaseUrl);
  await seedPlayMyData(databaseUrl, options);
};
