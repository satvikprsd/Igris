import { Move } from "../move/move";

export enum NodeType {
    Exact,
    LowerBound,
    UpperBound
}

export interface TTEntry {
    zobrist: bigint;
    depth: number;
    score: number;
    nodeType: NodeType;
    bestMove: Move | null;
}

// for future me I don't fully understand how Transposition Table works, so please clean this code later.
export class TranspositionTable {
    private table: Map<bigint, TTEntry>;
    public static readonly LOOKUP_FAILED = -100000
    
    constructor() {
        this.table = new Map<bigint, TTEntry>();
    }

    get(zobrist: bigint): TTEntry | null {
        return this.table.get(zobrist) || null;
    }
    
    put(entry: TTEntry): void {
        const existing = this.table.get(entry.zobrist);
        if (!existing || entry.depth >= existing.depth) {
            this.table.set(entry.zobrist, entry);
        }
    }


    clear(): void {
        this.table.clear();
    }

    lookupEvaluation(zobrist: bigint, depth: number, plyFromRoot: number, alpha: number, beta: number): number {
        const entry = this.table.get(zobrist);
        
        // Entry not found
        if (!entry) {
            return TranspositionTable.LOOKUP_FAILED;
        }
        
        if (entry.depth < depth) {
            return TranspositionTable.LOOKUP_FAILED;
        }
        
        let score = entry.score;
        score = this.correctRetrievedMateScore(score, plyFromRoot);
        
        if (entry.nodeType === NodeType.Exact) return score;
        if (entry.nodeType === NodeType.UpperBound && score <= alpha) return score;
        if (entry.nodeType === NodeType.LowerBound && score >= beta) return score;
        
        return TranspositionTable.LOOKUP_FAILED;
    }

    storeEvaluation(zobrist: bigint, depth: number, plyFromRoot: number,score: number, nodeType: NodeType, bestMove: Move | null): void {
        const adjustedScore = this.correctMateScoreForStorage(score, plyFromRoot);

        this.put({zobrist, depth, score: adjustedScore, nodeType, bestMove});
    }

    private correctRetrievedMateScore(score: number, plyFromRoot: number): number {
        const MATE_SCORE = 100000;
        const MATE_THRESHOLD = MATE_SCORE - 1000;
        
        if (score > MATE_THRESHOLD) {
            return score - plyFromRoot;
        } else if (score < -MATE_THRESHOLD) {
            return score + plyFromRoot;
        }
        
        return score;
    }

    private correctMateScoreForStorage(score: number, plyFromRoot: number): number {
        const MATE_SCORE = 100000;
        const MATE_THRESHOLD = MATE_SCORE - 1000;
        
        if (score > MATE_THRESHOLD) {
            return score + plyFromRoot;
        } else if (score < -MATE_THRESHOLD) {
            return score - plyFromRoot;
        }
        
        return score;
    }
}