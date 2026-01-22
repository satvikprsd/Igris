import express from 'express';
import cors from 'cors';
import path from 'path';
import { Board } from './src/board';
import { Piece } from './src/piece';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../public')));

const board = new Board();

board.loadPositionFromFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

app.get('/api/board', (req, res) => {
    res.json({
        board: board.toPieceArray(), // ["r", "n", ...]
        turn: (board.sideToMove === Piece.White) ? 'White' : 'Black'
    });
});

app.post('/api/reset', (req, res) => {
    board.loadPositionFromFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    res.json({ message: "Board reset" });
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