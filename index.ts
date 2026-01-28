import express from 'express';
import cors from 'cors';
import path from 'path';
import { Board } from './src/board/board';
import { Piece } from './src/board/piece';
import { MoveUtils, stringToSquare } from './src/move/move';
import { MoveGenerator } from './src/move/move_generator';
import { Evaluation } from './src/engine/evaluation';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../public')));

const board = new Board();
const moveGenerator = new MoveGenerator(board);
const moves: number[] = [];

board.loadPositionFromFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

app.get('/api/board', (req, res) => {
    res.json({
        board: board.toPieceArray(), // ["r", "n", ...]
        legalMoves: moveGenerator.generateLegalMoves(board.sideToMove).map((move) => MoveUtils.moveToString(move)),
        turn: (board.sideToMove === Piece.White) ? 'White' : 'Black'
    });
});

app.post('/api/reset', (req, res) => {
    board.loadPositionFromFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    res.json({ message: "Board reset" });
});

app.post('/api/move', (req, res) => {
    console.log(moveGenerator.generateLegalMoves(board.sideToMove).map((move) => MoveUtils.moveToString(move)));
    const { from, to } = req.body;
    const sourceSquare = stringToSquare(from);
    const targetSquare = stringToSquare(to);
    const move = moveGenerator.createMoveWithContext(sourceSquare, targetSquare);
    moves.push(move);
    board.makeMove(move);
    console.log(Evaluation.evaluate(board));
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

app.listen(port, () => {
    console.log(`Chess Engine running at http://localhost:${port}`);
});