import { Board, BoardUtils } from "../board/board";
import { Piece, PieceUtils } from "../board/piece";
import { Attacks } from "../move/attacks";
import { MoveOrdering } from "./moveOrdering";

export class Evaluation {

    static pieceValues: { [key: number]: number } = {
        [Piece.Pawn]: 100,
        [Piece.Knight]: 320,
        [Piece.Bishop]: 330,
        [Piece.Rook]: 500,
        [Piece.Queen]: 900,
    };

    private static ENDGAME = 0b100000;
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

    static endgameMaterialStart = this.pieceValues[Piece.Rook]!*2 + this.pieceValues[Piece.Bishop]! + this.pieceValues[Piece.Knight]!;

    public static evaluate(board: Board): number {
        // board.printBoard();
        let whiteEval = 0
        let blackEval = 0;

        const whiteMaterial = this.countMaterial(board, Piece.White);
        const blackMaterial = this.countMaterial(board, Piece.Black);

        const whiteMaterialWithoutPawns = whiteMaterial - (BoardUtils.bitBoardCount(board.bitboards[Piece.Pawn | Piece.White]!) * this.pieceValues[Piece.Pawn]!);
        const blackMaterialWithoutPawns = blackMaterial - (BoardUtils.bitBoardCount(board.bitboards[Piece.Pawn | Piece.Black]!) * this.pieceValues[Piece.Pawn]!);

        const whiteEndgameWeight =  this.getEndgameWeight(whiteMaterialWithoutPawns);
        const blackEndgameWeight =  this.getEndgameWeight(blackMaterialWithoutPawns);

        whiteEval += whiteMaterial;
        blackEval += blackMaterial;
        whiteEval += this.MopUpEvaluation(Piece.White, Piece.Black, whiteMaterial, blackMaterial, whiteEndgameWeight, board);
        blackEval += this.MopUpEvaluation(Piece.Black, Piece.White, blackMaterial, whiteMaterial, blackEndgameWeight, board);

        whiteEval += this.evaluatePieceSquareTables(Piece.White, whiteEndgameWeight, board);
        blackEval += this.evaluatePieceSquareTables(Piece.Black, blackEndgameWeight, board);

        const evaluation = whiteEval - blackEval;
        const tacticalEvaluation = Evaluation.evaluateTacticalThreats(board);
        const perspective = board.sideToMove === Piece.White ? 1 : -1;

        return (evaluation + tacticalEvaluation) * perspective;
    }

    private static evaluateTacticalThreats(board: Board): number {
        let evaluation = 0;

        const whiteAttacks = MoveOrdering.getProtectedSquares(board, Piece.White);
        const blackAttacks = MoveOrdering.getProtectedSquares(board, Piece.Black);

        evaluation += Evaluation.evaluateHangingPieces(board, whiteAttacks, blackAttacks)*0.5;

        return evaluation;
    }

    private static evaluateHangingPieces(board: Board, whiteAttacks: bigint, blackAttacks: bigint): number {
        let evaluation = 0;

        for (let pieceType = Piece.Pawn ; pieceType <= Piece.Queen; pieceType++) {
            let pieceBB = board.bitboards[pieceType | Piece.White] || 0n;
            while (pieceBB !== 0n) {
                const square = this.getLSBIndex(pieceBB);
                const squareBB = 1n << BigInt(square);

                if ((blackAttacks & squareBB) !== 0n && (whiteAttacks & squareBB) === 0n) {
                    evaluation -= this.pieceValues[pieceType]! * 0.7;
                }
                pieceBB &= pieceBB - 1n;
            }
        }

        for (let pieceType = Piece.Pawn ; pieceType <= Piece.Queen; pieceType++) {
            let pieceBB = board.bitboards[pieceType | Piece.Black] || 0n;
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

    private static countMaterial(board: Board, side: Piece.White | Piece.Black): number {
        let material = 0;
        for (let piece = (Piece.Pawn | side); piece <= (Piece.Queen | side); piece++) {
            let bb = board.bitboards[piece];
            if (bb === 0n) continue;

            const pieceType = PieceUtils.getType(piece);
            const pieceValue = this.pieceValues[pieceType] || 0;

            const count = BoardUtils.bitBoardCount(bb!);
            material += count * pieceValue;
        }
        return material;
    }

    public static evaluatePieceSquareTables(side: Piece.White | Piece.Black, endgameWeight: number, board: Board): number {
        let value = 0;
        for (let piece = (Piece.Pawn | side); piece <= (Piece.Queen | side); piece++) {
            let bb = board.bitboards[piece];
            if (bb === 0n) continue;

            const pieceType = PieceUtils.getType(piece);
            const isEndgameKing = pieceType === Piece.King && endgameWeight > 0;
            const tableKey = isEndgameKing ? (Piece.King | this.ENDGAME) : pieceType;
            while (bb && bb !== 0n) {
                const square = this.getLSBIndex(bb);
                const tableIndex = side === Piece.White ? square ^ 56 : square;
                value += this.pieceSquareTables[tableKey]![tableIndex] || 0;
                bb &= bb - 1n;
            }
        }
        return value;
    }

    static getLSBIndex(bb: bigint): number {
        return Number(BigInt.asUintN(64, bb & -bb).toString(2).length - 1);
    }

    private static getEndgameWeight(materialWithoutPawns: number): number {
        const multiplier = 1 / this.endgameMaterialStart;
        return 1 - Math.min(1, materialWithoutPawns * multiplier);
    }

    private static MopUpEvaluation(myColor: Piece.White | Piece.Black, opponentColor: Piece.White | Piece.Black, myMaterial: number, opponentMaterial: number, endgameWeight: number, board: Board): number {
        let evaluation = 0;
        if (myMaterial > opponentMaterial + 2*Evaluation.pieceValues[Piece.Pawn]! && endgameWeight > 0) {
            const myKingSq = Evaluation.getLSBIndex(board.bitboards[Piece.King | myColor]!);
            const opponentKingSq = Evaluation.getLSBIndex(board.bitboards[Piece.King | opponentColor]!);

            evaluation += Evaluation.manhattanToCenter(opponentKingSq) * 10;
            evaluation += (14 - Evaluation.rookDistance(myKingSq, opponentKingSq)) * 4;
            evaluation += (7 - Evaluation.kingDistance(myKingSq, opponentKingSq)) * 2;
        }

        return evaluation * endgameWeight;
    }

    private static manhattanToCenter(sq: number): number {
        const file = sq & 7;
        const rank = sq >> 3;
        return Math.abs(file - 3.5) + Math.abs(rank - 3.5);
    }

    private static kingDistance(a: number, b: number): number {
        const fa = a & 7, ra = a >> 3;
        const fb = b & 7, rb = b >> 3;
        return Math.abs(fa - fb) + Math.abs(ra - rb)
    }

    private static rookDistance(a: number, b: number): number {
        const fa = a & 7, ra = a >> 3;
        const fb = b & 7, rb = b >> 3;

        return Math.abs(fa - fb) + Math.abs(ra - rb);
    }

}