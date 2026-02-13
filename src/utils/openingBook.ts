import fs from "fs";
import path from "path";

export type OpeningBook = Record<string, Record<number, number>>;

let openingBook: OpeningBook | null = null;

const BOOK_PATH = path.join(__dirname,"openingBook.json");

export function loadOpeningBook(): OpeningBook {
    if (openingBook) return openingBook;
    try {
        const raw = fs.readFileSync(BOOK_PATH, "utf8");
        openingBook = JSON.parse(raw);
    } catch (e) {
        console.log(e);
        openingBook = {};
    }
    return openingBook || {};
}

export function getBookMoves(hash: bigint): Record<number, number> | null {
    const book = loadOpeningBook();
    return book[hash.toString()] ?? null;
}

//softmax
export function pickBookMove(hash: bigint,temperature = 0.5): number | null {
    const moveMap = getBookMoves(hash);
    if (!moveMap) return null;

    const entries = Object.entries(moveMap).map(([move, count]) => [Number(move), count] as [number, number]);

    if (entries.length === 0) return null;

    const weights = entries.map(([_, count]) =>Math.pow(count, 1 / temperature));

    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;

    for (let i = 0; i < entries.length; i++) {
        r -= weights[i]!;
        if (r <= 0) return entries[i]![0];
    }

    return entries[0]![0];
}
