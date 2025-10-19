import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
    extractReleaseYear,
    loadPlayMyDataDataset,
    slugify
} from "../src/lib/playmydata-loader.js";

describe("playmydata-loader helpers", () => {
    it("slugify normalizes text", () => {
        expect(slugify("Super Mario Bros."))
            .toBe("super-mario-bros");
    });

    it("extractReleaseYear returns earliest candidate", () => {
        expect(extractReleaseYear("Released in 2005", "Remastered in 2010")).toBe(2005);
        expect(extractReleaseYear(undefined, "Future 2030 edition")).toBe(2030);
        expect(extractReleaseYear("No year here")).toBeNull();
    });
});

describe("loadPlayMyDataDataset", () => {
    const header = "genres,id,name,platforms,summary,storyline,rating,main,extra,completionist,review_score,review_count,people_polled\n";

    it("parses minimal dataset and normalizes records", () => {
        const tempDir = mkdtempSync(join(tmpdir(), "playmydata-test-"));

        try {
            writeFileSync(
                join(tempDir, "platforms.csv"),
                "48,PlayStation 4\n6,PC (Microsoft Windows)\n",
                "utf8"
            );

            const nintendoRow = "\"[31]\",123,Test Game,[48],\"Released in 2001.\",\"Story set in 2002.\",Missing,Missing,Missing,Missing,Missing,Missing,Missing\n";
            writeFileSync(join(tempDir, "all_games_Nintendo.csv"), header + nintendoRow, "utf8");
            writeFileSync(join(tempDir, "all_games_PlayStation.csv"), header, "utf8");
            writeFileSync(join(tempDir, "all_games_Xbox.csv"), header, "utf8");
            writeFileSync(join(tempDir, "all_games_PC.csv"), header, "utf8");

            const dataset = loadPlayMyDataDataset({ datasetDir: tempDir });

            expect(dataset.platforms).toHaveLength(1);
            expect(dataset.games).toHaveLength(1);
            expect(dataset.consoles).toHaveLength(1);

            const [platform] = dataset.platforms;
            expect(platform.slug).toBe("playstation-4-48");
            expect(platform.vendor).toBe("Sony");

            const [game] = dataset.games;
            expect(game.slug).toBe("test-game-playstation-4-48");
            expect(game.releaseYear).toBe(2001);
        } finally {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it("deduplicates games that would produce the same slug", () => {
        const tempDir = mkdtempSync(join(tmpdir(), "playmydata-test-"));

        try {
            writeFileSync(
                join(tempDir, "platforms.csv"),
                "130,Nintendo Switch\n",
                "utf8"
            );

            const duplicateGameRow = "[130],456,Paddles,[130],Missing,Missing,Missing,Missing,Missing,Missing,Missing,Missing,Missing\n";
            const fileContent = header + duplicateGameRow + duplicateGameRow;

            writeFileSync(join(tempDir, "all_games_Nintendo.csv"), header, "utf8");
            writeFileSync(join(tempDir, "all_games_PlayStation.csv"), header, "utf8");
            writeFileSync(join(tempDir, "all_games_Xbox.csv"), header, "utf8");
            writeFileSync(join(tempDir, "all_games_PC.csv"), fileContent, "utf8");

            const dataset = loadPlayMyDataDataset({ datasetDir: tempDir });

            expect(dataset.games).toHaveLength(1);
            expect(dataset.games[0]?.slug).toBe("paddles-nintendo-switch-130");
        } finally {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});