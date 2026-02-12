import { Board, BoardUtils } from "../board/board";
import { Piece, PieceUtils } from "../board/piece";
import { MoveOrdering } from "./moveOrdering";
interface MaterialInfo {
    numPawns: number;
    numKnights: number;
    numBishops: number;
    numRooks: number;
    numQueens: number;
    materialScore: number;
    endgameT: number;
    pawns: bigint;
    enemyPawns: bigint;
}
export class Evaluation {
    static pieceValues: { [key: number]: number } = {
        [Piece.Pawn]: 100,
        [Piece.Knight]: 300,
        [Piece.Bishop]: 320,
        [Piece.Rook]: 500,
        [Piece.Queen]: 900,
    };

    //Passed pawn bonuses by rank from promotion
    private static passedPawnBonuses = [0, 120, 80, 50, 30, 15, 15];
    
    //Isolated pawn penalties
    private static isolatedPawnPenaltyByCount = [0, -10, -25, -50, -75, -75, -75, -75, -75];
    
    // King pawn shield scores
    private static kingPawnShieldScores = [4, 7, 4, 3, 6, 3];

    private static ENDGAME = 0b100000;
    
    //Endgame
    private static queenEndgameWeight = 45;
    private static rookEndgameWeight = 20;
    private static bishopEndgameWeight = 10;
    private static knightEndgameWeight = 10;
    private static endgameStartWeight = 2 * Evaluation.rookEndgameWeight + 2 * Evaluation.bishopEndgameWeight +  2 * Evaluation.knightEndgameWeight + Evaluation.queenEndgameWeight;

    static pieceSquareTables: { [key: number]: number[] } = {
        [Piece.Pawn]: [
             0,  0,  0,  0,  0,  0,  0,  0,
            50, 50, 50, 50, 50, 50, 50, 50,
            10, 10, 20, 30, 30, 20, 10, 10,
             5,  5, 10, 25, 25, 10,  5,  5,
             0,  0,  0, 20, 20,  0,  0,  0,
             5, -5,-10,  0,  0,-10, -5,  5,
             5, 10, 10,-20,-20, 10, 10,  5,
             0,  0,  0,  0,  0,  0,  0,  0
        ],
        [Piece.Pawn | this.ENDGAME]: [
              0,   0,   0,   0,   0,   0,   0,   0,
            100, 100, 100, 100, 100, 100, 100, 100,
             80,  80,  80,  80,  80,  80,  80,  80,
             60,  60,  60,  60,  60,  60,  60,  60,
             40,  40,  40,  40,  40,  40,  40,  40,
             20,  20,  20,  20,  20,  20,  20,  20,
             20,  20,  20,  20,  20,  20,  20,  20,
              0,   0,   0,   0,   0,   0,   0,   0
        ],
        [Piece.Knight]: [
            -50,-40,-30,-30,-30,-30,-40,-50,
            -40,-20,  0,  0,  0,  0,-20,-40,
            -30,  0, 10, 15, 15, 10,  0,-30,
            -30,  5, 15, 20, 20, 15,  5,-30,
            -30,  0, 15, 20, 20, 15,  0,-30,
            -30,  5, 10, 15, 15, 10,  5,-30,
            -40,-20,  0,  5,  5,  0,-20,-40,
            -50,-40,-30,-30,-30,-30,-40,-50
        ],
        [Piece.Bishop]: [
            -20,-10,-10,-10,-10,-10,-10,-20,
            -10,  0,  0,  0,  0,  0,  0,-10,
            -10,  0,  5, 10, 10,  5,  0,-10,
            -10,  5,  5, 10, 10,  5,  5,-10,
            -10,  0, 10, 10, 10, 10,  0,-10,
            -10, 10, 10, 10, 10, 10, 10,-10,
            -10,  5,  0,  0,  0,  0,  5,-10,
            -20,-10,-10,-10,-10,-10,-10,-20
        ],
        [Piece.Rook]: [
             0,  0,  0,  0,  0,  0,  0,  0,
             5, 10, 10, 10, 10, 10, 10,  5,
            -5,  0,  0,  0,  0,  0,  0, -5,
            -5,  0,  0,  0,  0,  0,  0, -5,
            -5,  0,  0,  0,  0,  0,  0, -5,
            -5,  0,  0,  0,  0,  0,  0, -5,
            -5,  0,  0,  0,  0,  0,  0, -5,
             0,  0,  0,  5,  5,  0,  0,  0
        ],
        [Piece.Queen]: [
            -20,-10,-10, -5, -5,-10,-10,-20,
            -10,  0,  0,  0,  0,  0,  0,-10,
            -10,  0,  5,  5,  5,  5,  0,-10,
             -5,  0,  5,  5,  5,  5,  0, -5,
              0,  0,  5,  5,  5,  5,  0, -5,
            -10,  5,  5,  5,  5,  5,  0,-10,
            -10,  0,  5,  0,  0,  0,  0,-10,
            -20,-10,-10, -5, -5,-10,-10,-20
        ],
        [Piece.King]: [
            -30,-40,-40,-50,-50,-40,-40,-30,
            -30,-40,-40,-50,-50,-40,-40,-30,
            -30,-40,-40,-50,-50,-40,-40,-30,
            -30,-40,-40,-50,-50,-40,-40,-30,
            -20,-30,-30,-40,-40,-30,-30,-20,
            -10,-20,-20,-20,-20,-20,-20,-10,
             20, 20,  0,  0,  0,  0, 20, 20,
             20, 30, 10,  0,  0, 10, 30, 20
        ],
        [Piece.King | this.ENDGAME]: [
            -50,-40,-30,-20,-20,-30,-40,-50,
            -30,-20,-10,  0,  0,-10,-20,-30,
            -30,-10, 20, 30, 30, 20,-10,-30,
            -30,-10, 30, 40, 40, 30,-10,-30,
            -30,-10, 30, 40, 40, 30,-10,-30,
            -30,-10, 20, 30, 30, 20,-10,-30,
            -30,-30,  0,  0,  0,  0,-30,-30,
            -50,-30,-30,-30,-30,-30,-30,-50
        ]
    };

    static PSTScalingFactor = 0.8;

    public static evaluate(board: Board): number {
        let whiteEval = 0;
        let blackEval = 0;

        const whiteMaterialInfo = this.getMaterialInfo(board, Piece.White);
        const blackMaterialInfo = this.getMaterialInfo(board, Piece.Black);

        whiteEval += whiteMaterialInfo.materialScore;
        blackEval += blackMaterialInfo.materialScore;

        const whitePieceSqScore = this.evaluatePieceSquareTables(Piece.White, blackMaterialInfo.endgameT, board) * this.PSTScalingFactor;
        const blackPieceSqScore = this.evaluatePieceSquareTables(Piece.Black, whiteMaterialInfo.endgameT, board) * this.PSTScalingFactor;

        whiteEval += this.mopUpEvaluation(Piece.White, Piece.Black, whiteMaterialInfo, blackMaterialInfo, whiteMaterialInfo.endgameT, board);
        blackEval += this.mopUpEvaluation(Piece.Black, Piece.White, blackMaterialInfo, whiteMaterialInfo, blackMaterialInfo.endgameT, board);

        whiteEval += this.evaluatePawns(board, Piece.White);
        blackEval += this.evaluatePawns(board, Piece.Black);

        whiteEval += this.evaluateKingPawnShield(board, Piece.White, blackMaterialInfo, blackPieceSqScore);
        blackEval += this.evaluateKingPawnShield(board, Piece.Black, whiteMaterialInfo, whitePieceSqScore);

        const evaluation = whiteEval - blackEval;
        const tacticalEvaluation = this.evaluateTacticalThreats(board);
        
        const perspective = board.sideToMove === Piece.White ? 1 : -1;
        return (evaluation + tacticalEvaluation) * perspective;
    }

    private static getMaterialInfo(board: Board, color: Piece.White | Piece.Black): MaterialInfo {
        let numPawns = 0, numKnights = 0, numBishops = 0, numRooks = 0, numQueens = 0;
        
        const pawnBB = board.bitboards[Piece.Pawn | color] || 0n;
        const knightBB = board.bitboards[Piece.Knight | color] || 0n;
        const bishopBB = board.bitboards[Piece.Bishop | color] || 0n;
        const rookBB = board.bitboards[Piece.Rook | color] || 0n;
        const queenBB = board.bitboards[Piece.Queen | color] || 0n;
        
        numPawns = BoardUtils.bitBoardCount(pawnBB);
        numKnights = BoardUtils.bitBoardCount(knightBB);
        numBishops = BoardUtils.bitBoardCount(bishopBB);
        numRooks = BoardUtils.bitBoardCount(rookBB);
        numQueens = BoardUtils.bitBoardCount(queenBB);

        const materialScore = numPawns * this.pieceValues[Piece.Pawn]! + numKnights * this.pieceValues[Piece.Knight]! + numBishops * this.pieceValues[Piece.Bishop]! + numRooks * this.pieceValues[Piece.Rook]! + numQueens * this.pieceValues[Piece.Queen]!;

        const endgameWeightSum = numQueens * this.queenEndgameWeight + numRooks * this.rookEndgameWeight + numBishops * this.bishopEndgameWeight + numKnights * this.knightEndgameWeight;

        const endgameT = 1 - Math.min(1, endgameWeightSum/this.endgameStartWeight);

        return {
            numPawns,
            numKnights,
            numBishops,
            numRooks,
            numQueens,
            materialScore,
            endgameT,
            pawns: pawnBB,
            enemyPawns: board.bitboards[Piece.Pawn | (color ^ Piece.ColorMask)] || 0n
        };
    }
    
    private static evaluatePieceSquareTables(side: Piece.White | Piece.Black, endgameWeight: number, board: Board): number {
        let value = 0;
        for (let piece = (Piece.Pawn | side); piece <= (Piece.Queen | side); piece++) {
            let bb = board.bitboards[piece];
            if (bb === 0n) continue;

            const pieceType = PieceUtils.getType(piece);
            const isEndgameKing = pieceType === Piece.King && endgameWeight > 0;
            const isEndgamePawn = pieceType === Piece.Pawn && endgameWeight > 0;
            const tableKey = isEndgameKing ? (Piece.King | this.ENDGAME) : isEndgamePawn ? (Piece.Pawn | this.ENDGAME) : pieceType;
            while (bb && bb !== 0n) {
                const square = this.getLSBIndex(bb);
                const tableIndex = side === Piece.White ? square ^ 56 : square;
                value += this.pieceSquareTables[tableKey]![tableIndex] || 0;
                bb &= bb - 1n;
            }
        }
        return value;
    }

    private static mopUpEvaluation(myColor: Piece.White | Piece.Black, opponentColor: Piece.White | Piece.Black, myMaterialInfo: MaterialInfo, opponentMaterialInfo: MaterialInfo, endgameWeight: number, board: Board): number {
        let evaluation = 0;
        if (myMaterialInfo.materialScore > opponentMaterialInfo.materialScore + 2*Evaluation.pieceValues[Piece.Pawn]! && endgameWeight > 0) {
            const myKingSq = Evaluation.getLSBIndex(board.bitboards[Piece.King | myColor]!);
            const opponentKingSq = Evaluation.getLSBIndex(board.bitboards[Piece.King | opponentColor]!);

            evaluation += Evaluation.manhattanToCenter(opponentKingSq) * 10;
            evaluation += (14 - Evaluation.rookDistance(myKingSq, opponentKingSq)) * 4;
            evaluation += (7 - Evaluation.kingDistance(myKingSq, opponentKingSq)) * 2;
        }

        return evaluation * endgameWeight;
    }

    private static evaluatePawns(board: Board, color: Piece.White | Piece.Black): number {
        let score = 0;
        let numIsolatedPawns = 0;
        
        const isWhite = color === Piece.White;
        const pawnBB = board.bitboards[Piece.Pawn | color] || 0n;
        const opponentPawnBB = board.bitboards[Piece.Pawn | (color ^ Piece.ColorMask)] || 0n;
        
        let tempPawnBB = pawnBB;
        while (tempPawnBB !== 0n) {
            const square = this.getLSBIndex(tempPawnBB);
            const file = square & 7;
            const rank = square >> 3;
            
            //passed pawn
            const passedPawnMask = this.getPassedPawnMask(square, isWhite);
            if ((opponentPawnBB & passedPawnMask) === 0n) {
                const numSquaresFromPromotion = isWhite ? rank : 7 - rank;
                score += this.passedPawnBonuses[numSquaresFromPromotion] || 0;
            }
            
            //isolated pawn
            const adjacentFilesMask = this.getAdjacentFilesMask(file);
            if ((pawnBB & adjacentFilesMask) === 0n) {
                numIsolatedPawns++;
            }
            
            tempPawnBB &= tempPawnBB - 1n;
        }
        
        score += this.isolatedPawnPenaltyByCount[numIsolatedPawns] || 0;
        return score;
    }

    private static evaluateKingPawnShield(board: Board, color: Piece.White | Piece.Black, enemyMaterial: MaterialInfo, enemyPieceSqScore: number): number {
        // in endgame pawn shield is less important
        if (enemyMaterial.endgameT >= 0.8) {
            return 0;
        }

        let penalty = 0;
        const isWhite = color === Piece.White;
        const kingBB = board.bitboards[Piece.King | color] || 0n;
        const pawnBB = board.bitboards[Piece.Pawn | color] || 0n;
        
        if (kingBB === 0n) return 0;
        
        const kingSquare = this.getLSBIndex(kingBB);
        const kingFile = kingSquare & 7;
        const kingRank = kingSquare >> 3;

        let uncastledKingPenalty = 0;

        // king should be castled
        if (kingFile <= 2 || kingFile >= 5) {
            const shieldSquares = this.getPawnShieldSquares(kingSquare, isWhite);
            for (let i = 0; i < shieldSquares.length/2; i++) {
                const sqBB = 1n << BigInt(shieldSquares[i]!);
                if ((pawnBB & sqBB) === 0n) {
                    if (shieldSquares.length > 3){
                        const sq3BB = 1n << BigInt(shieldSquares[i + 3]!);
                        if ((pawnBB & sq3BB) === 0n) {
                            penalty += this.kingPawnShieldScores[i + 3]!;
                        } else {
                            penalty += this.kingPawnShieldScores[i]!;
                        }
                    }
                }
            }
            penalty = penalty * penalty;
        } else {
            const enemyDevelopmentScore = Math.max(0, Math.min(1, (enemyPieceSqScore + 10)/130))
            uncastledKingPenalty = Number(50 * enemyDevelopmentScore);
        }

        let openFileAgainstKingPenalty = 0;

        if (enemyMaterial.numRooks > 1 || (enemyMaterial.numQueens > 0 && enemyMaterial.numRooks > 0)) {
            const myPawns = enemyMaterial.enemyPawns;
            const clampedKingFile = Math.max(1, Math.min(6, kingFile));
            
            for (let attackFile = clampedKingFile; attackFile <= clampedKingFile + 1; attackFile++) {
                const fileMask = this.getFileMask(attackFile);
                const isKingFile = attackFile === kingFile;
                // enemy has no pawns on this file 
                if ((enemyMaterial.pawns & fileMask) === 0n) {
                    openFileAgainstKingPenalty += isKingFile ? 25 : 15;
                    // i have no pawns on this file
                    if ((myPawns & fileMask) === 0n) {
                        openFileAgainstKingPenalty += isKingFile ? 15 : 10;
                    }
                }
            }
        }

        let pawnShieldWeight = 1 - enemyMaterial.endgameT;
        if (enemyMaterial.numQueens === 0) {
            pawnShieldWeight *= 0.6;
        }

        return ((-penalty - uncastledKingPenalty - openFileAgainstKingPenalty) * pawnShieldWeight);
    }

    private static evaluateTacticalThreats(board: Board): number {
        let evaluation = 0;

        const whiteAttacks = MoveOrdering.getProtectedSquares(board, Piece.White);
        const blackAttacks = MoveOrdering.getProtectedSquares(board, Piece.Black);

        evaluation += this.evaluateHangingPieces(board, whiteAttacks, blackAttacks) * 0.6;

        return evaluation;
    }

    private static evaluateHangingPieces(board: Board, whiteAttacks: bigint, blackAttacks: bigint): number {
        let evaluation = 0;

        for (let pieceType = Piece.Pawn; pieceType <= Piece.Queen; pieceType++) {
            // White pieces
            let pieceBB = board.bitboards[pieceType | Piece.White] || 0n;
            while (pieceBB !== 0n) {
                const square = this.getLSBIndex(pieceBB);
                const squareBB = 1n << BigInt(square);

                if ((blackAttacks & squareBB) !== 0n && (whiteAttacks & squareBB) === 0n) {
                    evaluation -= this.pieceValues[pieceType]! * 0.7;
                }
                pieceBB &= pieceBB - 1n;
            }

            // Black pieces
            pieceBB = board.bitboards[pieceType | Piece.Black] || 0n;
            while (pieceBB !== 0n) {
                const square = this.getLSBIndex(pieceBB);
                const squareBB = 1n << BigInt(square);

                if ((whiteAttacks & squareBB) !== 0n && (blackAttacks & squareBB) === 0n) {
                    evaluation += this.pieceValues[pieceType]! * 0.7;
                }
                pieceBB &= pieceBB - 1n;
            }
        }

        return evaluation;
    }

    static getLSBIndex(bb: bigint): number {
        return Number(BigInt.asUintN(64, bb & -bb).toString(2).length - 1);
    }

    private static manhattanToCenter(sq: number): number {
        const file = sq & 7;
        const rank = sq >> 3;
        return Math.abs(file - 3.5) + Math.abs(rank - 3.5);
    }

    private static rookDistance(a: number, b: number): number {
        const fa = a & 7, ra = a >> 3;
        const fb = b & 7, rb = b >> 3;
        return Math.abs(fa - fb) + Math.abs(ra - rb);
    }

    private static kingDistance(a: number, b: number): number {
        const fa = a & 7, ra = a >> 3;
        const fb = b & 7, rb = b >> 3;
        return Math.abs(fa - fb) + Math.abs(ra - rb)
    }

    private static getPassedPawnMask(square: number, isWhite: boolean): bigint {
        const file = square & 7;
        const rank = square >> 3;
        let mask = 0n;
        
        const startRank = isWhite ? 0 : rank + 1;
        const endRank = isWhite ? rank : 8;
        
        for (let r = startRank; r < endRank; r++) {
            for (let f = Math.max(0, file - 1); f <= Math.min(7, file + 1); f++) {
                mask |= 1n << BigInt(r * 8 + f);
            }
        }
        
        return mask;
    }

    private static getAdjacentFilesMask(file: number): bigint {
        let mask = 0n;
        if (file > 0) {
            for (let rank = 0; rank < 8; rank++) {
                mask |= 1n << BigInt(rank * 8 + (file - 1));
            }
        }
        if (file < 7) {
            for (let rank = 0; rank < 8; rank++) {
                mask |= 1n << BigInt(rank * 8 + (file + 1));
            }
        }
        return mask;
    }

    private static getFileMask(file: number): bigint {
        let mask = 0n;
        for (let rank = 0; rank < 8; rank++) {
            mask |= 1n << BigInt(rank * 8 + file);
        }
        return mask;
    }

    private static getPawnShieldSquares(kingSquare: number, isWhite: boolean): number[] {
        const file = kingSquare & 7;
        const rank = kingSquare >> 3;
        const squares: number[] = [];
        
        const shieldRank = isWhite ? rank - 1 : rank + 1;
        
        if (shieldRank >= 0 && shieldRank < 8) {
            for (let f = Math.max(0, file - 1); f <= Math.min(7, file + 1); f++) {
                squares.push(shieldRank * 8 + f);
            }
        }
        
        return squares;
    }
}