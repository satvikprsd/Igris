import { Board } from "../board/board";
import { Piece, PieceUtils } from "../board/piece";

export class Evaluation {

    static pieceValues: { [key: number]: number } = {
        [Piece.Pawn]: 100,
        [Piece.Knight]: 320,
        [Piece.Bishop]: 330,
        [Piece.Rook]: 500,
        [Piece.Queen]: 900,
        [Piece.King]: 0
    };

    private static pieceSquareTables: { [key: number]: number[] } = {
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
    };

    public static evaluate(board: Board): number {
        // board.printBoard();
        const whiteEval = this.evalSide(Piece.White, board);
        const blackEval = this.evalSide(Piece.Black, board);
        const evaluation = whiteEval - blackEval;
        const perspective = board.sideToMove === Piece.White ? 1 : -1;
        return evaluation * perspective;
    }

    private static evalSide(side: Piece.White | Piece.Black, board: Board): number {
        let material = 0;
        const PST_SCALE = 0.15;
        for (let piece = (Piece.King | side); piece <= (Piece.Queen | side); piece++) {
            let bb = board.bitboards[piece];
            if (bb === 0n) continue;

            const pieceType = PieceUtils.getType(piece);

            const pieceValue = this.pieceValues[pieceType] || 0;
            const pst = this.pieceSquareTables[pieceType];

            while (bb !== 0n) {
                const square = this.getLSBIndex(bb!);
                bb! &= bb! - 1n;

                const pstScore = pst ? pst[side === Piece.White ? square : (square ^ 56)] || 0 : 0;
                material += pieceValue + Math.floor(pstScore*PST_SCALE);
            }
        }

        return material;
    }

    static getLSBIndex(bb: bigint): number {
        return Number(BigInt.asUintN(64, bb & -bb).toString(2).length - 1);
    }

}