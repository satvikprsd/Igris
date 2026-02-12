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
    generation: number;
}

// for future me I don't fully understand how Transposition Table works, so please clean this code later.
export class TranspositionTable {
    private table: TTEntry[];
    private readonly size: number;
    private generation: number = 0;
    public static readonly LOOKUP_FAILED = -100000;
    private static readonly EMPTY_ENTRY: TTEntry = {
        zobrist: 0n,
        depth: 0,
        score: 0,
        nodeType: NodeType.Exact,
        bestMove: null,
        generation: 0
    };
    
    constructor(sizeMB: number = 256) {
        const bytesPerEntry = 100;
        this.size = Math.floor(sizeMB * 1024 * 1024 / bytesPerEntry);
        this.table = new Array(this.size);
        
        for (let i = 0; i < this.size; i++) {
            this.table[i] = { ...TranspositionTable.EMPTY_ENTRY };
        }
    }

    private getIndex(zobrist: bigint): number {
        return Number(zobrist % BigInt(this.size));
    }

    get(zobrist: bigint): TTEntry | null {
        const index = this.getIndex(zobrist);
        const entry = this.table[index]!;
        
        if (entry.zobrist === zobrist) {
            return entry;
        }
        
        return null;
    }
    
    put(entry: TTEntry): void {
        const index = this.getIndex(entry.zobrist);
        const existing = this.table[index]!;
        const shouldReplace = 
            existing.zobrist === 0n ||
            existing.zobrist === entry.zobrist ||
            existing.generation < this.generation ||
            (existing.generation === this.generation && entry.depth >= existing.depth);
        
        if (shouldReplace) {
            this.table[index] = entry;
        }
    }

    clear(): void {
        for (let i = 0; i < this.size; i++) {
            this.table[i] = { ...TranspositionTable.EMPTY_ENTRY };
        }
        this.generation = 0;
    }
    
    newSearch(): void {
        this.generation++;
    }

    lookupEvaluation(zobrist: bigint, depth: number, plyFromRoot: number, alpha: number, beta: number): number {
        const index = this.getIndex(zobrist);
        const entry = this.table[index]!;
        
        // Entry not found
        if (entry.zobrist !== zobrist) {
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

    storeEvaluation(zobrist: bigint, depth: number, plyFromRoot: number, score: number, nodeType: NodeType, bestMove: Move | null): void {
        const adjustedScore = this.correctMateScoreForStorage(score, plyFromRoot);

        this.put({
            zobrist, 
            depth, 
            score: adjustedScore, 
            nodeType, 
            bestMove,
            generation: this.generation
        });
    }
    
    getBestMove(zobrist: bigint): Move | null {
        const entry = this.get(zobrist);
        return entry?.bestMove || null;
    }
    
    getTableSize(): number {
        return this.size;
    }
    
    getGeneration(): number {
        return this.generation;
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