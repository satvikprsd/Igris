import { Board, BoardUtils } from "../board/board";
import { Piece } from "../board/piece";
import { Attacks } from "../move/attacks";
import { ZOBRIST_CASTLING, ZOBRIST_ENPASSANT, ZOBRIST_PIECE, ZOBRIST_SIDE } from "../utils/zobristKeys";
import { Evaluation } from "./evaluation";


export class Zobrist {
    static pieceKeys: bigint[][] = ZOBRIST_PIECE;
    static sideKey: bigint = ZOBRIST_SIDE;
    static castlingKeys: bigint[] = ZOBRIST_CASTLING;
    static enPassantKeys: bigint[] = ZOBRIST_ENPASSANT;

    public static computeZobristKey(board: Board): bigint {
        let key = 0n;
        for (let piece = 1; piece <= 12; piece++) {
            let bb = board.bitboards[piece];
            while (bb && bb !== 0n) {
                const square = Attacks.getLSB(bb);
                key ^= this.pieceKeys[piece - 1]![square]!;
                bb &= bb - 1n;
            }
        }
        
        key ^= this.enPassantKeys[BoardUtils.getEnPassantFile(board) ?? -1] || 0n;

        if (board.sideToMove === Piece.Black) {
            key ^= this.sideKey;
        }

        key ^= this.castlingKeys[BoardUtils.getCastlingRights(board)] || 0n;

        return key;
    }
}