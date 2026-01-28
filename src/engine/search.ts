import { Board } from "../board/board";
import { Move } from "../move/move";
import { MoveGenerator } from "../move/move_generator";
import { Evaluation } from "./evaluation";
import { MoveOrdering } from "./moveOrdering";

export class Search {
    private moveGenerator: MoveGenerator;
    private bestMove: Move | null = null;
    private nodesSearched: number = 0;
    private positionsEvaluated: number = 0;

    constructor(board: Board) {
        this.moveGenerator = new MoveGenerator(board);
    }

    public search(board: Board, depth: number): Move | null {
        this.bestMove = null;
        this.nodesSearched = 0;
        this.positionsEvaluated = 0;
        console.time("Search Time");
        const moves = this.moveGenerator.generateLegalMoves(board.sideToMove);
        MoveOrdering.orderMoves(board, moves);

        if (moves.length === 0) return null;

        let alpha = -Infinity;
        const beta = Infinity;

        for (const move of moves) {
            board.makeMove(move);
            const score = -this.alphaBeta(board, depth - 1, -beta, -alpha);
            board.unmakeMove(move);

            if (score > alpha) {
                alpha = score;
                this.bestMove = move;
            }
        }

        console.log(`Nodes searched: ${this.nodesSearched}`);
        console.log(`Positions evaluated: ${this.positionsEvaluated}`);
        console.timeEnd("Search Time");
        return this.bestMove;
    }

    private searchAllCaptures(board: Board, alpha: number, beta: number, qsDepth: number = 0): number {
        this.positionsEvaluated++;
        const evaluation = Evaluation.evaluate(board);
        
        if (evaluation >= beta) {
            return beta;
        }
        alpha = Math.max(alpha, evaluation);

        const MAX_QS_DEPTH = 4;
        if (qsDepth > MAX_QS_DEPTH) {
            return alpha;
        }

        const captureMoves = this.moveGenerator.generateLegalMoves(board.sideToMove, true);
    
        if (captureMoves.length === 0) {
            return alpha;
        }

        for (const move of captureMoves) {
            board.makeMove(move);
            const score = -this.searchAllCaptures(board, -beta, -alpha, qsDepth + 1);
            board.unmakeMove(move);
            
            if (score >= beta) {
                return beta;
            }
            alpha = Math.max(alpha, score);
        }
        return alpha;
    }

    private alphaBeta(board: Board, depth: number, alpha: number, beta: number): number {
        this.nodesSearched++;
        if (depth === 0) {
            this.positionsEvaluated++;
            return this.searchAllCaptures(board, alpha, beta);
        }

        const moves = this.moveGenerator.generateLegalMoves(board.sideToMove);
        MoveOrdering.orderMoves(board, moves);

        if (moves.length === 0) {
            this.positionsEvaluated++;
            if (this.moveGenerator.isKingInCheck(board.sideToMove)) {
                return -100000 + depth; // Checkmate
            }
            return 0; // Stalemate
        }

        for (const move of moves) {
            board.makeMove(move);
            const evaluation = -this.alphaBeta(board, depth - 1, -beta, -alpha);
            board.unmakeMove(move);
            if (evaluation >= beta) {
                return beta;
            }
            alpha = Math.max(alpha, evaluation);
        }

        return alpha;
    }
}