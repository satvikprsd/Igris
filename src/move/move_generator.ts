import { Board, BoardUtils } from "../board/board";
import { Piece, PieceUtils } from "../board/piece";
import { Move, MoveFlag, MoveUtils, squareToString } from "./move";

export class MoveGenerator {

    public static generateLegalMoves(board: Board, color: number): Move[] {
        const moves: Move[] = [];
        return moves;
    }

    public static createMoveWithContext(board: Board, source: number, target: number): Move {
        const targetMask = 1n << BigInt(target);
        
        const movingPiece = board.getPieceOnSquare(source);
        const pieceType = PieceUtils.getType(movingPiece);

        const sourceRank = source >> 3;
        const targetRank = target >> 3;

        const isCapture = (board.sideToMove === Piece.White ? (board.blackPieces & targetMask) : (board.whitePieces & targetMask)) !== 0n;
        const isPawnPromotion = pieceType === Piece.Pawn && ((board.sideToMove === Piece.White && targetRank === 7) || (board.sideToMove === Piece.Black && targetRank === 0));
        const isDoublePawnPush = pieceType === Piece.Pawn && Math.abs(targetRank - sourceRank) === 2;
        console.log(target, BoardUtils.getEnPassantSquare(board));
        const isEnPassant = pieceType === Piece.Pawn && target === BoardUtils.getEnPassantSquare(board);
        const isKingCastle = pieceType === Piece.King && target === source + 2;
        const isQueenCastle = pieceType === Piece.King && target === source - 2;

        let flag: MoveFlag;

        if (isPawnPromotion && isCapture) flag = MoveFlag.PromotionToQueenCapture;
        else if (isPawnPromotion) flag = MoveFlag.PromotionToQueen;
        else if (isEnPassant) flag = MoveFlag.EnPassant;
        else if (isKingCastle) flag = MoveFlag.KingCastle;
        else if (isQueenCastle) flag = MoveFlag.QueenCastle;
        else if (isCapture) flag = MoveFlag.Capture;
        else if (isDoublePawnPush) flag = MoveFlag.DoublePawnPush;
        else flag = MoveFlag.Quiet;

        console.log(`Creating move from ${squareToString(source)} to ${squareToString(target)} with flag ${MoveFlag[flag]}`);
        return MoveUtils.encode(source, target, flag);
    }
}