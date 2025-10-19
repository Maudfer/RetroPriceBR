import { Client } from "pg";

interface SeedRecord {
  slug: string;
  title: string;
  currencyCode: string;
}

const defaultGuides: SeedRecord[] = [
  {
    slug: "super-famicom",
    title: "Super Famicom",
    currencyCode: "BRL",
  },
  {
    slug: "mega-drive",
    title: "Mega Drive",
    currencyCode: "BRL",
  },
  {
    slug: "n64",
    title: "Nintendo 64",
    currencyCode: "BRL",
  },
];

export const runSeeds = async (databaseUrl: string): Promise<void> => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to seed the database");
  }

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
