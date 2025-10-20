import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import type {
    NormalizedConsole,
    NormalizedGame,
    NormalizedPlatform
} from "../lib/catalog-loader.js";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(MODULE_DIR, "../../../..");

const PLAYMYDATA_SOURCE = "PLAYMYDATA";
const RETRO_GAMES_SOURCE = "RETRO_GAMES";
const OUTPUT_FILE_NAME = "catalog.csv";
const RETRO_PLATFORM_OFFSET = 1_000_000;
const RETRO_GAME_OFFSET = 1_000_000_000;

const NON_CONSOLE_TOKENS = [
    "pc",
    "windows",
    "mac",
    "linux",
    "ios",
    "android",
    "steam",
    "browser",
    "mobile",
    "smartphone",
    "arcade"
];

interface LoadPlayMyDataOptions {
    datasetDir?: string;
}

interface PlayMyDataDataset {
    platforms: NormalizedPlatform[];
    consoles: NormalizedConsole[];
    games: NormalizedGame[];
}

interface RetroGamesRow {
    Name: string;
    Platform: string;
    Year_of_Release?: string;
}

type OutputValue = string | number | boolean | null | undefined;

interface OutputRow {
    source: string;
    platformExternalId: number;
    platformName: string;
    platformSlug: string;
    platformVendor: string | null;
    platformIsConsole: boolean;
    consoleExternalId: number | null;
    consoleTitle: string | null;
    consoleSlug: string | null;
    consoleVendor: string | null;
    gameExternalId: number;
    gameTitle: string;
    gameSlug: string;
    gameReleaseYear: number | null;
}

const sanitizeValue = (value: string | undefined | null): string | undefined => {
    if (!value) {
        return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === "missing" || trimmed.toLowerCase() === "nan") {
        return undefined;
    }

    return trimmed;
};

const parseNumberArray = (raw: string | undefined): number[] => {
    if (!raw) {
        return [];
    }

    const sanitized = sanitizeValue(raw);
    if (!sanitized) {
        return [];
    }

    const matches = sanitized.match(/-?\d+/g);
    if (!matches) {
        return [];
    }

    return matches.map((value) => Number.parseInt(value, 10)).filter((value) => Number.isFinite(value));
};

const inferVendor = (name: string): string | null => {
    const lower = name.toLowerCase();

    if (lower.includes("nintendo")) {
        return "Nintendo";
    }

    if (lower.includes("playstation") || lower.includes("sony")) {
        return "Sony";
    }

    if (lower.includes("xbox") || lower.includes("microsoft")) {
        return "Microsoft";
    }

    if (lower.includes("sega")) {
        return "Sega";
    }

    if (lower.includes("atari")) {
        return "Atari";
    }

    if (lower.includes("commodore") || lower.includes("amiga")) {
        return "Commodore";
    }

    if (lower.includes("neo geo")) {
        return "SNK";
    }

    if (lower.includes("apple")) {
        return "Apple";
    }

    const firstToken = name.split(/[^a-zA-Z0-9]+/).filter(Boolean)[0];
    if (!firstToken) {
        return null;
    }

    return `${firstToken[0].toUpperCase()}${firstToken.slice(1)}`;
};

const isConsolePlatform = (name: string): boolean => {
    const lower = name.toLowerCase();
    return !NON_CONSOLE_TOKENS.some((token) => lower.includes(token));
};

const yearRegex = /(19|20)\d{2}/g;

export const extractReleaseYear = (...candidates: Array<string | undefined>): number | null => {
    const years: number[] = [];

    for (const candidate of candidates) {
        if (!candidate) {
            continue;
        }

        const matches = candidate.match(yearRegex);
        if (!matches) {
            continue;
        }

        for (const value of matches) {
            const parsed = Number.parseInt(value, 10);
            if (parsed >= 1970 && parsed <= 2035) {
                years.push(parsed);
            }
        }
    }

    if (years.length === 0) {
        return null;
    }

    return Math.min(...years);
};

export const slugify = (value: string): string => {
    const normalized = value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return normalized || "item";
};

const parseReleaseYear = (value: string | undefined): number | null => {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === "n/a" || trimmed.toLowerCase() === "nan") {
        return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed)) {
        return null;
    }

    if (parsed < 1970 || parsed > 2035) {
        return null;
    }

    return parsed;
};

const escapeCsvValue = (value: OutputValue): string => {
    if (value === null || value === undefined) {
        return "";
    }

    const stringValue = String(value);
    if (stringValue.includes("\"") || stringValue.includes(",") || stringValue.includes("\n")) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
};

const resolveRetroGamesPath = (): string => {
    const explicitPath = process.env.RETRO_GAMES_DATASET;
    if (explicitPath) {
        const absolute = resolve(explicitPath);
        if (!existsSync(absolute)) {
            throw new Error(`RetroGames dataset not found at ${absolute}`);
        }

        return absolute;
    }

    const candidates = [
        resolve(process.cwd(), "datasets/RetroGames/RetroGames.csv"),
        resolve(process.cwd(), "../datasets/RetroGames/RetroGames.csv"),
        resolve(WORKSPACE_ROOT, "datasets/RetroGames/RetroGames.csv")
    ];

    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error("RetroGames dataset not found. Set RETRO_GAMES_DATASET or place RetroGames.csv under datasets/RetroGames.");
};

const loadRetroGamesDataset = (): RetroGamesRow[] => {
    const csvPath = resolveRetroGamesPath();
    const fileContent = readFileSync(csvPath, "utf8");
    return parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    }) as RetroGamesRow[];
};

const ensureDirectory = (directory: string): void => {
    if (!existsSync(directory)) {
        mkdirSync(directory, { recursive: true });
    }
};

const createGameKey = (platformName: string, gameTitle: string): string => {
    return `${slugify(platformName)}::${slugify(gameTitle)}`;
};

const writeCsv = (rows: OutputRow[], outputPath: string): void => {
    const headers: Array<keyof OutputRow> = [
        "source",
        "platformExternalId",
        "platformName",
        "platformSlug",
        "platformVendor",
        "platformIsConsole",
        "consoleExternalId",
        "consoleTitle",
        "consoleSlug",
        "consoleVendor",
        "gameExternalId",
        "gameTitle",
        "gameSlug",
        "gameReleaseYear"
    ];

    const lines: string[] = [];
    lines.push(headers.join(","));

    for (const row of rows) {
        const values = headers.map((header) => escapeCsvValue(row[header] as OutputValue));
        lines.push(values.join(","));
    }

    writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
};

const mergeDatasets = (): void => {
    const playMyData = loadPlayMyDataDataset();
    const retroGames = loadRetroGamesDataset();

    const platformById = new Map<number, NormalizedPlatform>();
    const platformByName = new Map<string, NormalizedPlatform>();
    const consoleByPlatformId = new Map<number, NormalizedConsole>();
    const rowByKey = new Map<string, OutputRow>();

    for (const platform of playMyData.platforms) {
        platformById.set(platform.externalId, { ...platform });
        platformByName.set(platform.name.toLowerCase(), platform);
    }

    for (const console of playMyData.consoles) {
        consoleByPlatformId.set(console.platformExternalId, console);
    }

    let nextPlatformId = RETRO_PLATFORM_OFFSET;
    let nextGameId = RETRO_GAME_OFFSET;

    const rows: OutputRow[] = [];

    for (const game of playMyData.games) {
        const platform = platformById.get(game.platformExternalId);
        if (!platform) {
            continue;
        }

        const console = consoleByPlatformId.get(platform.externalId) ?? null;
        const key = createGameKey(platform.name, game.title);
        if (rowByKey.has(key)) {
            continue;
        }

        const outputRow: OutputRow = {
            source: PLAYMYDATA_SOURCE,
            platformExternalId: platform.externalId,
            platformName: platform.name,
            platformSlug: platform.slug,
            platformVendor: platform.vendor ?? null,
            platformIsConsole: platform.isConsole,
            consoleExternalId: console?.externalId ?? null,
            consoleTitle: console?.title ?? null,
            consoleSlug: console?.slug ?? null,
            consoleVendor: console?.vendor ?? null,
            gameExternalId: game.externalId,
            gameTitle: game.title,
            gameSlug: game.slug,
            gameReleaseYear: game.releaseYear ?? null
        };

        rows.push(outputRow);
        rowByKey.set(key, outputRow);
    }

    for (const row of retroGames) {
        const title = row.Name?.trim();
        const platformName = row.Platform?.trim();

        if (!title || !platformName) {
            continue;
        }

        const platformLookupKey = platformName.toLowerCase();
        let platform = platformByName.get(platformLookupKey);

        if (!platform) {
            const externalId = nextPlatformId++;
            const slug = `${slugify(platformName)}-${externalId}`;
            const vendor = inferVendor(platformName);
            platform = {
                externalId,
                name: platformName,
                slug,
                vendor: vendor ?? undefined,
                isConsole: isConsolePlatform(platformName)
            };

            platformById.set(externalId, platform);
            platformByName.set(platformLookupKey, platform);

            if (platform.isConsole) {
                consoleByPlatformId.set(externalId, {
                    externalId,
                    title: platformName,
                    slug,
                    vendor: vendor ?? undefined,
                    platformExternalId: externalId
                });
            }
        }

        if (!platform.vendor) {
            const inferredVendor = inferVendor(platform.name);
            if (inferredVendor) {
                platform.vendor = inferredVendor;
            }
        }

        const console = consoleByPlatformId.get(platform.externalId) ?? null;
        const key = createGameKey(platform.name, title);
        const releaseYear = parseReleaseYear(row.Year_of_Release);

        const existingRow = rowByKey.get(key);
        if (existingRow) {
            if (releaseYear != null && (existingRow.gameReleaseYear == null || releaseYear < existingRow.gameReleaseYear)) {
                existingRow.gameReleaseYear = releaseYear;
            }

            if (!existingRow.platformVendor && platform.vendor) {
                existingRow.platformVendor = platform.vendor ?? null;
            }

            if (!existingRow.consoleExternalId && console) {
                existingRow.consoleExternalId = console.externalId;
                existingRow.consoleTitle = console.title;
                existingRow.consoleSlug = console.slug;
                existingRow.consoleVendor = console.vendor ?? null;
            } else if (console && !existingRow.consoleVendor && console.vendor) {
                existingRow.consoleVendor = console.vendor ?? null;
            }

            if (!existingRow.source.includes(RETRO_GAMES_SOURCE)) {
                existingRow.source = `${existingRow.source}+${RETRO_GAMES_SOURCE}`;
            }

            continue;
        }

        const externalId = nextGameId++;
        const slug = `${slugify(title)}-${platform.slug}`;

        const outputRow: OutputRow = {
            source: RETRO_GAMES_SOURCE,
            platformExternalId: platform.externalId,
            platformName: platform.name,
            platformSlug: platform.slug,
            platformVendor: platform.vendor ?? null,
            platformIsConsole: platform.isConsole,
            consoleExternalId: console?.externalId ?? null,
            consoleTitle: console?.title ?? null,
            consoleSlug: console?.slug ?? null,
            consoleVendor: console?.vendor ?? null,
            gameExternalId: externalId,
            gameTitle: title,
            gameSlug: slug,
            gameReleaseYear: releaseYear
        };

        rows.push(outputRow);
        rowByKey.set(key, outputRow);
    }

    rows.sort((a, b) => {
        const platformCompare = a.platformName.localeCompare(b.platformName, "en", { sensitivity: "base" });
        if (platformCompare !== 0) {
            return platformCompare;
        }

        return a.gameTitle.localeCompare(b.gameTitle, "en", { sensitivity: "base" });
    });

    const outputDir = resolve(WORKSPACE_ROOT, "datasets/RetroPriceBR");
    ensureDirectory(outputDir);
    const outputPath = resolve(outputDir, OUTPUT_FILE_NAME);

    writeCsv(rows, outputPath);

    console.log(`[merge] wrote ${rows.length} rows to ${outputPath}`);
};

const resolvePlayMyDataDirectory = (customDir: string | undefined): string => {
    if (customDir) {
        const absolute = resolve(customDir);
        if (!existsSync(absolute)) {
            throw new Error(`PlayMyData dataset directory not found at ${absolute}`);
        }

        return absolute;
    }

    const envDir = process.env.PLAYMYDATA_DIR;
    if (envDir) {
        const absolute = resolve(envDir);
        if (existsSync(absolute)) {
            return absolute;
        }
    }

    const candidates = [
        resolve(process.cwd(), "../../datasets/PlayMyData"),
        resolve(process.cwd(), "datasets/PlayMyData"),
        resolve(MODULE_DIR, "../../../../datasets/PlayMyData"),
        resolve(MODULE_DIR, "../../../datasets/PlayMyData")
    ];

    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error(
        "PlayMyData dataset directory not found. Set PLAYMYDATA_DIR or ensure datasets/PlayMyData is available."
    );
};

const readPlatformCsv = (datasetDir: string): Map<number, NormalizedPlatform> => {
    const filePath = resolve(datasetDir, "platforms.csv");
    const rawFile = readFileSync(filePath, "utf8");
    const rows = parse(rawFile, {
        columns: ["id", "name"],
        skip_empty_lines: true,
        trim: true
    }) as Array<{ id: string; name: string }>;

    const platforms = new Map<number, NormalizedPlatform>();

    for (const row of rows) {
        const id = Number.parseInt(row.id, 10);
        if (!Number.isFinite(id)) {
            continue;
        }

        const name = row.name?.trim();
        if (!name) {
            continue;
        }

        const slug = `${slugify(name)}-${id}`;
        platforms.set(id, {
            externalId: id,
            name,
            slug,
            vendor: inferVendor(name) ?? undefined,
            isConsole: isConsolePlatform(name)
        });
    }

    return platforms;
};

const GAME_FILES = [
    "all_games_Nintendo.csv",
    "all_games_PlayStation.csv",
    "all_games_Xbox.csv",
    "all_games_PC.csv"
];

export const loadPlayMyDataDataset = (options: LoadPlayMyDataOptions = {}): PlayMyDataDataset => {
    const datasetDir = resolvePlayMyDataDirectory(options.datasetDir);

    const platformMap = readPlatformCsv(datasetDir);
    const games: NormalizedGame[] = [];
    const usedPlatformIds = new Set<number>();
    const seenPairs = new Set<string>();
    const usedSlugs = new Set<string>();

    for (const fileName of GAME_FILES) {
        const filePath = resolve(datasetDir, fileName);
        const fileContent = readFileSync(filePath, "utf8");
        const rows = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        }) as Array<{
            id: string;
            name: string;
            platforms: string;
            summary?: string;
            storyline?: string;
        }>;

        for (const row of rows) {
            const id = Number.parseInt(row.id, 10);
            if (!Number.isFinite(id)) {
                continue;
            }

            const title = sanitizeValue(row.name);
            if (!title) {
                continue;
            }

            const platformIds = parseNumberArray(row.platforms);
            if (platformIds.length === 0) {
                continue;
            }

            const summary = sanitizeValue(row.summary);
            const storyline = sanitizeValue(row.storyline);
            const releaseYear = extractReleaseYear(summary, storyline);

            for (const platformExternalId of platformIds) {
                if (!platformMap.has(platformExternalId)) {
                    continue;
                }

                const key = `${id}:${platformExternalId}`;
                if (seenPairs.has(key)) {
                    continue;
                }

                seenPairs.add(key);
                usedPlatformIds.add(platformExternalId);

                const platform = platformMap.get(platformExternalId)!;
                const gameSlug = `${slugify(title)}-${platform.slug}`;

                if (usedSlugs.has(gameSlug)) {
                    continue;
                }
                usedSlugs.add(gameSlug);

                games.push({
                    externalId: id,
                    title,
                    slug: gameSlug,
                    platformExternalId,
                    releaseYear
                });
            }
        }
    }

    const platforms = Array.from(platformMap.values()).filter((platform) =>
        usedPlatformIds.has(platform.externalId)
    );

    const consoles: NormalizedConsole[] = platforms
        .filter((platform) => platform.isConsole)
        .map((platform) => ({
            externalId: platform.externalId,
            title: platform.name,
            slug: platform.slug,
            vendor: platform.vendor,
            platformExternalId: platform.externalId
        }));

    return {
        platforms,
        consoles,
        games
    };
};

const isCliInvocation = (): boolean => {
    const invokedPath = process.argv[1];
    if (!invokedPath) {
        return false;
    }

    return resolve(invokedPath) === fileURLToPath(import.meta.url);
};

export const generateCatalog = (): void => {
    mergeDatasets();
};

if (isCliInvocation()) {
    generateCatalog();
}

export { mergeDatasets };
