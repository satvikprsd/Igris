import express from 'express';
import cors from 'cors';
import path from 'path';
import { Board } from './src/board/board';
import { Piece } from './src/board/piece';
import { MoveUtils, stringToSquare } from './src/move/move';
import { MoveGenerator } from './src/move/move_generator';
import { Evaluation } from './src/engine/evaluation';
import { Search } from './src/engine/search';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../public')));


const board = new Board();
const moveGenerator = new MoveGenerator(board);
const search = new Search(board);
const moves: number[] = [];
const initialFen = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQ - 0 1";


board.loadPositionFromFen(initialFen);

app.get('/api/board', (req, res) => {
    res.json({
        board: board.toPieceArray(), // ["r", "n", ...]
        legalMoves: moveGenerator.generateLegalMoves(board.sideToMove).map((move) => MoveUtils.moveToString(move)),
        isCheckMate: moveGenerator.isKingInCheck(board.sideToMove) && moveGenerator.generateLegalMoves(board.sideToMove).length === 0,
        turn: (board.sideToMove === Piece.White) ? 'White' : 'Black'
    });
});

app.post('/api/reset', (req, res) => {
    board.loadPositionFromFen(initialFen);
    res.json({ message: "Board reset" });
});

app.post('/api/move', (req, res) => {
    const { from, to } = req.body;
    const sourceSquare = stringToSquare(from);
    const targetSquare = stringToSquare(to);
    const move = moveGenerator.createMoveWithContext(sourceSquare, targetSquare);
    moves.push(move);
    board.makeMove(move);
    res.json({ message: `Moved from ${from} to ${to}` });
} );

app.post('/api/undo', (req, res) => {
    if (moves.length === 0) {
        return res.status(400).json({ error: "No moves to undo" });
    }
    const lastMove = moves.pop()!;
    board.unmakeMove(lastMove);
    res.json({ message: "Last move undone" });
});

app.post('/api/test-move', (req, res) => {
    board.popBit(Piece.White | Piece.Pawn, 12);
    board.setBit(Piece.White | Piece.Pawn, 28);
    board.updateOccupancies();
    res.json({ message: "Moved e2 to e4" });
});

app.post('/api/bot-move', (req, res) => {
    const legalMoves = moveGenerator.generateLegalMoves(board.sideToMove);
    if (legalMoves.length === 0) {
        return res.json({ message: "Game over" });
    }
    const depth = req.body.depth ?? 4
    const bestMove = search.search(board, depth);

    if (!bestMove) {
        return res.status(500).json({ error: "Bot failed to find a move" });
    }

    const moveString = MoveUtils.moveToString(bestMove);

    board.makeMove(bestMove);
    moves.push(bestMove);

    const evaluation = Evaluation.evaluate(board);
    res.json({
        move: moveString,
        evaluation,
        turn: board.sideToMove === Piece.White ? "White" : "Black"
    });
});


app.listen(port, () => {
    console.log(`Chess Engine running at http://localhost:${port}`);
});

