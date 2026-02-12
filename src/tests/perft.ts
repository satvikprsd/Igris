import { Board } from "../board/board";
import { MoveGenerator } from "../move/move_generator";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const board = new Board();
const moveGenerator = new MoveGenerator(board);

function testPerft (depth: number) : number {
    if (depth === 0) return 1;
    
    let nodes = 0;
    const moves = moveGenerator.generateLegalMoves(board.sideToMove);
    for (const move of moves) {
        board.makeMove(move);
        nodes += testPerft(depth - 1);
        board.unmakeMove(move);
        // console.log(MoveUtils.moveToString(move), nodes);
    }
    return nodes;
}

// https://www.chessprogramming.org/Perft_Results
const perftPositions: { [key: number]: { fen: string; table: { [depth: number]: number } } } = {
    1 : {
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        table: {
            1: 20,
            2: 400,
            3: 8902,
            4: 197281,
            5: 4865609,
        }
    },
    2 : {
        fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - ",
        table: {
            1: 48,
            2: 2039,
            3: 97862,
            4: 4085603,
            5: 193690690,
        }
    },
    3 : {
        fen: "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
        table: {
            1: 14,
            2: 191,
            3: 2812,
            4: 43238,
            5: 674624,
        }
    },
    4: {
        fen: "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
        table: {
            1: 6,
            2: 264,
            3: 9467,
            4: 422333,
            5: 15833292,
        }
    },
    5: {
        fen: "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
        table: {
            1: 44,
            2: 1486,
            3: 62379,
            4: 2103487,
            5: 89941194,
        }
    },
    6: {
        fen: "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10 ",
        table: {
            1: 46,
            2: 2079,
            3: 89890,
            4: 3894594,
            5: 164075551,
        }
    }
}

const position  = process.argv[2] ? perftPositions[parseInt(process.argv[2])] : undefined;
const depth = process.argv[3] ? parseInt(process.argv[3]) : undefined;

if (!position || !depth) {
    const maxDepth = 3;
    console.log("Usage: npm run perft <position_number> <depth>");
    console.log("Staring Bulk Perft Test...");
    describe("Perft Tests", () => {
        for (const key in perftPositions) {
            const pos = perftPositions[key]!;

            describe(`Position ${key}`, () => {
                for (let depth = 1; depth <= maxDepth; depth++) {
                    it(`Depth ${depth}`, () => {
                        board.loadPositionFromFen(pos.fen);

                        const start = process.hrtime.bigint();
                        const nodes = testPerft(depth);
                        const end = process.hrtime.bigint();

                        const elapsedNs = Number(end - start);
                        const elapsedSeconds = elapsedNs / 1e9;
                        const nps = Math.floor(nodes / elapsedSeconds);

                        console.log(
                            `Pos ${key} | Depth ${depth} | Nodes ${nodes.toLocaleString()} | ` +
                            `Time ${elapsedSeconds.toFixed(3)}s | NPS ${nps.toLocaleString()}`
                        );

                        const expected = pos.table?.[depth];
                        if (expected !== undefined) {
                            assert.equal(nodes, expected);
                        }
                    });
                }
            });
        }
    });
}
else {
    describe(`Perft test for position: ${position!.fen}`, () => {
        it(`Depth ${depth}`, () => {
            console.log(`Running perft test for position: ${position!.fen} at depth ${depth}`);
            board.loadPositionFromFen(position!.fen);
            const start = process.hrtime.bigint();
            const nodes = testPerft(depth);
            const end = process.hrtime.bigint();
            const elapsedNs = Number(end - start);
            const elapsedSeconds = elapsedNs / 1e9;
            const nps = nodes / elapsedSeconds;

            console.log(`Nodes: ${nodes}`);
            console.log(position!.table[depth] === nodes ? "Perft test passed!" : "Perft test failed!");
            console.log(`Time taken: ${elapsedSeconds.toFixed(2)} seconds`);
            console.log(`NPS: ${nps.toLocaleString()}`);
            assert.equal(nodes, position!.table[depth]);
        });
    });
}
