import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(MODULE_DIR, "../../../..");

export const RETROPRICE_SOURCE = "RETROPRICEBR";
export const RETROPRICE_LISTING_NOTE = "RetroPriceBR combined dataset listing";

export interface LoadRetroPriceOptions {
    datasetDir?: string;
    datasetPath?: string;
}

export interface NormalizedPlatform {
    externalId: number;
    name: string;
    slug: string;
    vendor?: string;
    isConsole: boolean;
}

export interface NormalizedConsole {
    externalId: number;
    title: string;
    slug: string;
    vendor?: string;
    platformExternalId: number;
}

export interface NormalizedGame {
    externalId: number;
    title: string;
    slug: string;
    platformExternalId: number;
    releaseYear: number | null;
}

export interface CatalogDataset {
    platforms: NormalizedPlatform[];
    consoles: NormalizedConsole[];
    games: NormalizedGame[];
}

interface CatalogCsvRow {
    source: string;
    platformExternalId: string;
    platformName: string;
    platformSlug: string;
    platformVendor?: string;
    platformIsConsole: string;
    consoleExternalId?: string;
    consoleTitle?: string;
    consoleSlug?: string;
    consoleVendor?: string;
    gameExternalId: string;
    gameTitle: string;
    gameSlug: string;
    gameReleaseYear?: string;
}

const toNullableString = (value: string | undefined): string | undefined => {
    if (!value) {
        return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }

    return trimmed;
};

const parseBoolean = (value: string): boolean => {
    return value.trim().toLowerCase() === "true";
};

const parseNumber = (value: string | undefined | null): number | null => {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
};

const resolveCatalogPath = (options: LoadRetroPriceOptions = {}): string => {
    if (options.datasetPath) {
        const absolute = resolve(options.datasetPath);
        if (!existsSync(absolute)) {
            throw new Error(`RetroPriceBR dataset not found at ${absolute}`);
        }
        return absolute;
    }

    if (options.datasetDir) {
        const candidate = resolve(options.datasetDir, "catalog.csv");
        if (!existsSync(candidate)) {
            throw new Error(`RetroPriceBR dataset not found under ${options.datasetDir}`);
        }
        return candidate;
    }

    const envPath = process.env.RETROPRICE_DATASET;
    if (envPath) {
        const absolute = resolve(envPath);
        if (!existsSync(absolute)) {
            throw new Error(`RetroPriceBR dataset not found at ${absolute}`);
        }
        return absolute;
    }

    const envDir = process.env.PLAYMYDATA_DIR;
    if (envDir) {
        const candidate = resolve(envDir, "catalog.csv");
        if (existsSync(candidate)) {
            return candidate;
        }
    }

    const candidates = [
        resolve(process.cwd(), "datasets/RetroPriceBR/catalog.csv"),
        resolve(process.cwd(), "../datasets/RetroPriceBR/catalog.csv"),
        resolve(WORKSPACE_ROOT, "datasets/RetroPriceBR/catalog.csv")
    ];

    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error("RetroPriceBR catalog not found. Provide RETROPRICE_DATASET or place catalog.csv under datasets/RetroPriceBR.");
};

export const loadRetroPriceDataset = (options: LoadRetroPriceOptions = {}): CatalogDataset => {
    const catalogPath = resolveCatalogPath(options);
    const rawFile = readFileSync(catalogPath, "utf8");
    const rows = parse(rawFile, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    }) as CatalogCsvRow[];

    const platformMap = new Map<number, NormalizedPlatform>();
    const consoleMap = new Map<number, NormalizedConsole>();
    const gameMap = new Map<string, NormalizedGame>();

    for (const row of rows) {
        const platformExternalId = parseNumber(row.platformExternalId);
        if (platformExternalId == null || !row.platformName || !row.platformSlug) {
            continue;
        }

        if (!platformMap.has(platformExternalId)) {
            platformMap.set(platformExternalId, {
                externalId: platformExternalId,
                name: row.platformName,
                slug: row.platformSlug,
                vendor: toNullableString(row.platformVendor),
                isConsole: parseBoolean(row.platformIsConsole)
            });
        }

        const consoleExternalId = parseNumber(row.consoleExternalId ?? undefined);
        if (consoleExternalId != null && row.consoleTitle && row.consoleSlug) {
            if (!consoleMap.has(consoleExternalId)) {
                consoleMap.set(consoleExternalId, {
                    externalId: consoleExternalId,
                    title: row.consoleTitle,
                    slug: row.consoleSlug,
                    vendor: toNullableString(row.consoleVendor),
                    platformExternalId
                });
            }
        }

        const gameExternalId = parseNumber(row.gameExternalId);
        if (gameExternalId == null || !row.gameTitle || !row.gameSlug) {
            continue;
        }

        const gameKey = `${platformExternalId}:${gameExternalId}`;
        if (!gameMap.has(gameKey)) {
            gameMap.set(gameKey, {
                externalId: gameExternalId,
                title: row.gameTitle,
                slug: row.gameSlug,
                platformExternalId,
                releaseYear: parseNumber(row.gameReleaseYear)
            });
        }
    }

    return {
        platforms: Array.from(platformMap.values()),
        consoles: Array.from(consoleMap.values()),
        games: Array.from(gameMap.values())
    };
};
