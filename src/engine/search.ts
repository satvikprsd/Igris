import { Board } from "../board/board";
import { Piece } from "../board/piece";
import { Move, MoveFlag, MoveUtils } from "../move/move";
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
    private startTime: number = 0;
    private timeLimit: number = 2000; // 2 sec
    private shouldStop: boolean = false;

    constructor(board: Board) {
        this.board = board;
        this.moveGenerator = new MoveGenerator(board);
        this.transpositionTable = new TranspositionTable();
    }

    public search(timePerMove: number): [Move | null, number] | null {
        this.bestMove = null;
        this.bestEvaluation = 0;
        this.nodesSearched = 0;
        this.positionsEvaluated = 0;
        this.repetitionTable.clear();

        this.startTime = Date.now();
        this.timeLimit = timePerMove;
        this.shouldStop = false;
        
        this.gameHistoryHashes = this.board.gameStateHistory.slice(0, this.board.historyIndex).map(state => state.zobrist);
        
        console.time("Search Time");
        // console.log("Position:");
        // this.board.printBoard();
        // console.log(`Side to move: ${this.board.sideToMove === Piece.White ? 'White' : 'Black'}`);
        
        let moves = this.moveGenerator.generateLegalMoves(this.board.sideToMove);
        // console.log(`Legal moves: ${moves.map(m => MoveUtils.moveToString(m)).join(', ')}`);
        
        if (moves.length === 0) return null;

        // Iterative Deepening
        let currentDepth = 1;
        const MAX_DEPTH = 50;
        while (currentDepth <= MAX_DEPTH && !this.shouldStop) {
            let alpha = -Infinity;
            const beta = Infinity;
            let depthCompleted = true;
            
            const ttEntry = this.transpositionTable.get(this.board.zobristKey);
            const ttMove = ttEntry?.bestMove ?? null;
            
            MoveOrdering.orderMoves(this.board, moves, ttMove);
            // console.log(`Depth ${currentDepth} ordered moves: ${moves.map(m => MoveUtils.moveToString(m)).join(', ')}`);
            
            let bestMoveThisDepth: Move | null = null;
            let bestScoreThisDepth = -Infinity;

            for (const move of moves) {
                if (this.isTimeUp()){
                    this.shouldStop = true;
                    depthCompleted = false;
                    break;
                }

                this.repetitionTable.clear();

                this.board.makeMove(move);
                // console.log(`ROOT: ${MoveUtils.moveToString(move)}`);
                const score = -this.alphaBeta(currentDepth, 0, -beta, -alpha, null);
                // console.log(`Move: ${MoveUtils.moveToString(move)}, Score: ${score}`);
                this.board.unmakeMove(move);
                if (score > alpha) {
                    alpha = score;
                    bestScoreThisDepth = score;
                    bestMoveThisDepth = move;
                }
            }

            if (depthCompleted && bestMoveThisDepth !== null) {
                this.bestMove = bestMoveThisDepth;
                this.bestEvaluation = bestScoreThisDepth;
            }

            currentDepth++;
        }
        
        console.log(`Final depth: ${currentDepth - 1}`);
        console.log(`Nodes searched: ${this.nodesSearched}`);
        console.log(`Positions evaluated: ${this.positionsEvaluated}`);
        console.timeEnd("Search Time");
        return [this.bestMove, this.bestEvaluation];
    }

    private searchAllCaptures(alpha: number, beta: number, qsDepth: number = 0): number {
        this.positionsEvaluated++;
        const evaluation = Evaluation.evaluate(this.board);
        
        if (evaluation >= beta) {
            return beta;
        }
        alpha = Math.max(alpha, evaluation);

        const MAX_QS_DEPTH = 10;
        if (qsDepth > MAX_QS_DEPTH) {
            return alpha;
        }
        
        const inCheck = this.moveGenerator.isKingInCheck(this.board.sideToMove);
        const captureMoves = this.moveGenerator.generateLegalMoves(this.board.sideToMove, !inCheck);
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

    private alphaBeta(depth: number, plyFromRoot: number, alpha: number, beta: number, prevMove: Move | null = null): number {
        this.nodesSearched++;

        if (this.isTimeUp()) {
            this.shouldStop = true;
            return 0;
        }


        const alphaOrig = alpha;
        const betaOrig = beta;
        
        if (plyFromRoot > 0) {
            // Repetition check
            // if (this.isRepetition(this.board.zobristKey)) {
            //     return 0; // draw
            // }

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
        let moveIndex = 0;

        for (const move of moves) {
            this.board.makeMove(move);
            
            let evaluation: number;
            
            // Late Move Reduction
            if (moveIndex >= 4 && depth >= 3 && !this.moveGenerator.isKingInCheck(this.board.sideToMove ^ Piece.ColorMask)) {
                const flag = MoveUtils.getMoveFlag(move);
                const isQuiet = flag !== MoveFlag.Capture && flag < MoveFlag.PromotionToKnightCapture;
                
                if (isQuiet) {
                    evaluation = -this.alphaBeta(depth - 2, plyFromRoot + 1, -beta, -alpha, move);
                    if (evaluation > alpha) {
                        evaluation = -this.alphaBeta(depth - 1, plyFromRoot + 1, -beta, -alpha, move);
                    }
                } else {
                    evaluation = -this.alphaBeta(depth - 1, plyFromRoot + 1, -beta, -alpha, move);
                }
            } else {
                evaluation = -this.alphaBeta(depth - 1, plyFromRoot + 1, -beta, -alpha, move);
            }
            
            this.board.unmakeMove(move);
            moveIndex++;

            if (evaluation > bestScore) {
                bestScore = evaluation;
                bestMove = move;
            }
            
            alpha = Math.max(alpha, evaluation);
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
        const newCount = (this.repetitionTable.get(zobristKey) || 0) + 1;
        this.repetitionTable.set(zobristKey, newCount);
    }

    private popKeyFromRepetitionTable(zobristKey: bigint): void {
        const count = this.repetitionTable.get(zobristKey);
        if (count == 1) {
            this.repetitionTable.delete(zobristKey);
        } else if (count) {
            this.repetitionTable.set(zobristKey, count - 1);
        }
    }

    private isRepetition(zobristKey: bigint): boolean {
        let count = 0;
        for (const hash of this.gameHistoryHashes) {
            if (hash === zobristKey) {
                count++;
            }
        }

        count += this.repetitionTable.get(zobristKey) || 0;
        return count >= 3;
    }

    private isTimeUp(): boolean {
        if (this.nodesSearched % 2048 === 0) {
            const elapsed = Date.now() - this.startTime;
            return elapsed >= this.timeLimit;
        }
        return this.shouldStop;
    }
}