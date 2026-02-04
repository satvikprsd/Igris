import express from 'express';
import cors from 'cors';
import path from 'path';
import { Board } from './src/board/board';
import { Piece, PieceUtils } from './src/board/piece';
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
const initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
let playerColor = Piece.White;

board.loadPositionFromFen(initialFen);

app.get('/api/board', (req, res) => {  
    res.json({
        board: board.toPieceArray(), // ["r", "n", ...]
        legalMoves: moveGenerator.generateLegalMoves(board.sideToMove).map((move) => MoveUtils.moveToString(move)),
        isCheckMate: moveGenerator.isKingInCheck(board.sideToMove) && moveGenerator.generateLegalMoves(board.sideToMove).length === 0,
        turn: (board.sideToMove === Piece.White) ? 'White' : 'Black',
        playerColor: (playerColor === Piece.White) ? 'White' : 'Black'
    });
});

app.post('/api/reset', (req, res) => {
    board.loadPositionFromFen(initialFen);
    playerColor = Piece.White;
    res.json({ message: "Board reset" });
});

app.post('/api/move', (req, res) => {
    const { from, to } = req.body;
    const sourceSquare = stringToSquare(from);
    const targetSquare = stringToSquare(to);
    const move = moveGenerator.createMoveWithContext(sourceSquare, targetSquare);
    const evaluationScoreFrom = Evaluation.pieceSquareTables[Piece.Pawn]![sourceSquare]!;
    const evaluationScoreTo = Evaluation.pieceSquareTables[Piece.Pawn]![targetSquare]!;
    console.log(`Evaluation score from: ${evaluationScoreFrom}, to: ${evaluationScoreTo}`);
    moves.push(move);
    board.makeMove(move);
    console.log(board.zobristKey.toString(16));
    res.json({ message: `Moved from ${from} to ${to}` });
} );

app.post('/api/undo', (req, res) => {
    if (moves.length === 0) {
        return res.status(400).json({ error: "No moves to undo" });
    }
    const lastMove = moves.pop()!;
    board.unmakeMove(lastMove);
    console.log(board.zobristKey.toString(16));
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
        console.log(moves.map(m => MoveUtils.moveToString(m)).join(' '));
        return res.json({ message: "Game over" });
    }
    const depth = 4;
    const [bestMove, bestEvaluation] = search.search(depth)!;

    if (!bestMove) {
        return res.status(500).json({ error: "Bot failed to find a move" });
    }

    const moveString = MoveUtils.moveToString(bestMove);

    board.makeMove(bestMove);
    moves.push(bestMove);

    res.json({
        move: moveString,
        evaluation: bestEvaluation * (board.sideToMove === Piece.White ? -1 : 1)/100,
        turn: board.sideToMove === Piece.White ? "White" : "Black"
    });
});

app.post('/api/flip-side', (req, res) => {
    playerColor = playerColor === Piece.White ? Piece.Black : Piece.White;
    res.json({ 
        message: "Side flipped",
        playerColor: (playerColor === Piece.White) ? 'White' : 'Black',
        botColor: (playerColor === Piece.White) ? 'Black' : 'White'
    });
});


app.listen(port, () => {
    console.log(`Chess Engine running at http://localhost:${port}`);
});

