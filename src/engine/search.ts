import { Board } from "../board/board";
import { MoveGenerator } from "../move/move_generator";
import { Evaluation } from "./evaluation";

export class Search {
    public static negamax(board: Board, depth: number): number {
        if (depth === 0) {
            return Evaluation.evaluate(board);
        }

        const move_generator = new MoveGenerator(board);
        const moves = move_generator.generateLegalMoves(board.sideToMove);

        if (moves.length === 0) {
            if (move_generator.isKingInCheck(board.sideToMove)) {
                return -100000 + (10 - depth); // Checkmate
            } else {
                return 0; // Stalemate
            }
        }

        let maxEval = -Infinity;
        for (const move of moves) {
            board.makeMove(move);
            const score = -this.negamax(board, depth - 1);
            board.unmakeMove(move);
            maxEval = Math.max(maxEval, score);
        }

        return maxEval;
    }
}