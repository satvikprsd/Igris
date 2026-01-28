import { Board } from "../board/board";
import { Piece, PieceUtils } from "../board/piece";

export class Evaluation {

    private static pieceValues: { [key: number]: number } = {
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
        board.printBoard();
        let score = 0;

        for (let square = 0; square < 64; square++) {
            const piece = board.getPieceOnSquare(square);
            if (piece === Piece.None) continue;

            const pieceType = PieceUtils.getType(piece);
            const isWhite = PieceUtils.isWhite(piece);

            let pieceValue = this.pieceValues[pieceType] || 0;
            const pstScore = this.pieceSquareTables[pieceType] ? this.pieceSquareTables[pieceType]![isWhite ? square : square ^ 56] || 0 : 0;
            score += isWhite ? (pieceValue + pstScore) : -(pieceValue + pstScore);
        }

        return board.sideToMove === Piece.White ? score : -score;
    }
}