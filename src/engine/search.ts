import { Board } from "../board/board";
import { Piece } from "../board/piece";
import { Move, MoveUtils } from "../move/move";
import { MoveGenerator } from "../move/move_generator";
import { Evaluation } from "./evaluation";
import { MoveOrdering } from "./moveOrdering";
import { NodeType, TranspositionTable } from "./transpositionTable";

export class Search {
    private board: Board;
    private moveGenerator: MoveGenerator;
    private transpositionTable: TranspositionTable;
    private bestMove: Move | null = null;
    private bestEvaluation: number = 0;
    private nodesSearched: number = 0;
    private positionsEvaluated: number = 0;
    private repetitionTable: Map<bigint, number> = new Map();
    private gameHistoryHashes: bigint[] = []; 

    constructor(board: Board) {
        this.board = board;
        this.moveGenerator = new MoveGenerator(board);
        this.transpositionTable = new TranspositionTable();
    }

    public search(depth: number): [Move | null, number] | null {
        this.bestMove = null;
        this.bestEvaluation = 0;
        this.nodesSearched = 0;
        this.positionsEvaluated = 0;
        this.repetitionTable.clear();

        this.gameHistoryHashes = this.board.gameStateHistory.map(state => state.zobrist);
        this.gameHistoryHashes.push(this.board.zobristKey);
        
        // console.time("Search Time");
        // console.log("Position:");
        // this.board.printBoard();
        // console.log(`Side to move: ${this.board.sideToMove === Piece.White ? 'White' : 'Black'}`);
        
        let moves = this.moveGenerator.generateLegalMoves(this.board.sideToMove);
        // console.log(`Legal moves: ${moves.map(m => MoveUtils.moveToString(m)).join(', ')}`);
        
        MoveOrdering.orderMoves(this.board, moves);
        // console.log(moves);
        // console.log(`Ordered moves: ${moves.map(m => MoveUtils.moveToString(m)).join(', ')}`);

        if (moves.length === 0) return null;

        let alpha = -Infinity;
        const beta = Infinity;
        
        for (const move of moves) {
            this.board.makeMove(move);
            // console.log(`ROOT: ${MoveUtils.moveToString(move)}`);
            const score = -this.alphaBeta(depth, 0, -beta, -alpha);
            // console.log(`Move: ${MoveUtils.moveToString(move)}, Score: ${score}`);
            this.board.unmakeMove(move);

            // console.log(`ROOT: ${MoveUtils.moveToString(move)} => score: ${score}`);

            if (score > alpha) {
                alpha = score;
                this.bestEvaluation = score;
                this.bestMove = move;
            }
        }
        // console.log(`Depth: ${depth}`);
        // console.log(`Nodes searched: ${this.nodesSearched}`);
        // console.log(`Positions evaluated: ${this.positionsEvaluated}`);
        // console.timeEnd("Search Time");
        return [this.bestMove, this.bestEvaluation];
    }

    private searchAllCaptures(alpha: number, beta: number, qsDepth: number = 0): number {
        this.positionsEvaluated++;
        const evaluation = Evaluation.evaluate(this.board);
        
        if (evaluation >= beta) {
            return beta;
        }
        alpha = Math.max(alpha, evaluation);

        const MAX_QS_DEPTH = 6;
        if (qsDepth > MAX_QS_DEPTH) {
            return alpha;
        }

        const captureMoves = this.moveGenerator.generateLegalMoves(this.board.sideToMove, true);
        MoveOrdering.orderMoves(this.board, captureMoves);

        if (captureMoves.length === 0) {
            return alpha;
        }

        for (const move of captureMoves) {
            this.board.makeMove(move);
            const score = -this.searchAllCaptures(-beta, -alpha, qsDepth + 1);
            this.board.unmakeMove(move);
            
            if (score >= beta) {
                return beta;
            }
            alpha = Math.max(alpha, score);
        }
        return alpha;
    }
    public immediateMateScore: number = 100000;

    private alphaBeta(depth: number, plyFromRoot: number, alpha: number, beta: number): number {
        this.nodesSearched++;
        const alphaOrig = alpha;
        const betaOrig = beta;

        // Repetition check
        if (this.isRepetition(this.board.zobristKey)) {
            return 0; // draw
        }
        
        if (plyFromRoot > 0) {
            alpha = Math.max(alpha, -this.immediateMateScore + plyFromRoot);
            beta = Math.min(beta, this.immediateMateScore - plyFromRoot);
            if (alpha >= beta) {
                return alpha;
            }
        }
        
        this.pushKeyToRepetitionTable(this.board.zobristKey);

        // TT lookup
        const ttEval = this.transpositionTable.lookupEvaluation(this.board.zobristKey, depth, plyFromRoot, alphaOrig, betaOrig);
        
        if (ttEval !== TranspositionTable.LOOKUP_FAILED) {
            this.popKeyFromRepetitionTable(this.board.zobristKey);
            return ttEval;
        }

        const moves = this.moveGenerator.generateLegalMoves(this.board.sideToMove);

        if (moves.length === 0) {
            this.positionsEvaluated++;
            this.popKeyFromRepetitionTable(this.board.zobristKey);
            if (this.moveGenerator.isKingInCheck(this.board.sideToMove)) {
                return -this.immediateMateScore + plyFromRoot;
            }
            return 0; // Stalemate
        }

        if (depth === 0) {
            this.popKeyFromRepetitionTable(this.board.zobristKey);
            return this.searchAllCaptures(alpha, beta);
        }

        //TT move for move ordering
        const ttEntry = this.transpositionTable.get(this.board.zobristKey);
        const ttMove = ttEntry?.bestMove ?? null;
        
        MoveOrdering.orderMoves(this.board, moves, ttMove);

        let bestScore = -Infinity;
        let bestMove: Move | null = null;

        for (const move of moves) {
            this.board.makeMove(move);
            const evaluation = -this.alphaBeta(depth - 1, plyFromRoot + 1, -beta, -alpha);
            this.board.unmakeMove(move);

            if (evaluation > bestScore) {
                bestScore = evaluation;
                bestMove = move;
            }
            
            alpha = Math.max(alpha, evaluation);

            if (alpha >= beta) {
                break;
            }
        }

        let nodeType: NodeType;
        if (bestScore <= alphaOrig) nodeType = NodeType.UpperBound;
        else if (bestScore >= betaOrig) nodeType = NodeType.LowerBound;
        else nodeType = NodeType.Exact;


        this.transpositionTable.storeEvaluation(this.board.zobristKey, depth, plyFromRoot, bestScore, nodeType, bestMove);

        this.popKeyFromRepetitionTable(this.board.zobristKey);

        return bestScore;
    }
    private pushKeyToRepetitionTable(zobristKey: bigint): void {
        this.repetitionTable.set(zobristKey, (this.repetitionTable.get(zobristKey) || 0) + 1);
    }

    private popKeyFromRepetitionTable(zobristKey: bigint): void {
        const count = this.repetitionTable.get(zobristKey);
        if (count == 1) this.repetitionTable.delete(zobristKey);
        else if (count) this.repetitionTable.set(zobristKey, count - 1);
    }

    private isRepetition(zobristKey: bigint): boolean {
        let count = 0;
        for (const hash of this.gameHistoryHashes) {
            if (hash === zobristKey) {
                count++;
            }
        }
        count += (this.repetitionTable.get(zobristKey) || 0);
        return count >= 3;
    }

}