import fs from "fs";
import readline from "readline";
import pgnParser from "pgn-parser";
import { Chess } from "chess.js";

import { Board } from "../board/board";
import { MoveGenerator } from "../move/move_generator";

type Book = Map<string, Map<number, number>>;

console.log("Generating");

async function buildBookStream(pgnPath: string): Promise<Book> {
    const book: Book = new Map();

    const fileStream = fs.createReadStream(pgnPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    let currentGame = "";

    for await (const line of rl) {
        if (line.startsWith("[Event") && currentGame.length > 0) {
            processGameFast(currentGame, book);
            currentGame = "";
        }

        currentGame += line + "\n";
    }

    if (currentGame.length > 0) {
        processGameFast(currentGame, book);
    }

    return book;
}

function processGameFast(gameText: string, book: Book) {
    let parsed;
    try {
        parsed = pgnParser.parse(gameText);
    } catch {
        return;
    }

    if (!parsed || parsed.length === 0) return;

    const game = parsed[0]!;

    const chess = new Chess();
    const board = new Board();
    const moveGenerator = new MoveGenerator(board);
    board.loadPositionFromFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

    let plyCount = 0;

    for (const turn of game.moves) {
        if (plyCount >= 12) break;

        const san = turn.move;
        if (!san) continue;

        const result = chess.move(san);
        if (!result) break;

        const source = squareStringToIndex(result.from);
        const target = squareStringToIndex(result.to);

        const move = moveGenerator.createMoveWithContext(source, target);

        const hash = board.zobristKey.toString();

        if (!book.has(hash)) {
            book.set(hash, new Map());
        }

        const moveMap = book.get(hash)!;
        moveMap.set(move, (moveMap.get(move) || 0) + 1);

        board.makeMove(move);
        plyCount++;
    }
}

function squareStringToIndex(square: string): number {
    const file = square.charCodeAt(0) - 97;
    const rank = parseInt(square[1]!) - 1;
    return rank * 8 + file;
}

function convertToSerializable(book: Book) {
    const obj: Record<string, Record<number, number>> = {};

    for (const [hash, moveMap] of book.entries()) {
        obj[hash] = {};
        for (const [move, count] of moveMap.entries()) {
            obj[hash][move] = count;
        }
    }

    return obj;
}

(async () => {
    const book = await buildBookStream("/Users/satvik/Documents/Projects/Igris/src/utils/games.pgn");

    const finalBook = convertToSerializable(book);

    fs.writeFileSync("openingBook.json", JSON.stringify(finalBook));

    console.log("Opening book generated");
})();
