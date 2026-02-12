import { Board } from "../board/board";
import { Piece, PieceUtils } from "../board/piece";
import { Attacks } from "../move/attacks";
import { Move, MoveUtils } from "../move/move";
import { Evaluation } from "./evaluation";

export class MoveOrdering {
    public static orderMoves(board: Board, moves: Move[], ttMove: Move | null = null): void {
        const opponentPawnAttacks = board.sideToMove === Piece.White ? Attacks.blackPawnAttacksFromBitboard(board.bitboards[Piece.Pawn | Piece.Black]!) : Attacks.whitePawnAttacksFromBitboard(board.bitboards[Piece.Pawn | Piece.White]!);

        const opponentProtectedSquares = this.getProtectedSquares(board, board.sideToMove ^ Piece.ColorMask);
        const scored = moves.map(move => ({move, score: this.scoreMove(board, move, opponentPawnAttacks, opponentProtectedSquares, ttMove)}));

        scored.sort((a, b) => b.score - a.score);

        for (let i = 0; i < moves.length; i++) {

            moves[i] = scored[i]!.move;
        }
        
    }

    private static scoreMove(board: Board, move: Move, opponentPawnAttacks: bigint, protectedSquares: bigint, ttMove: Move | null): number {
        if (ttMove && move === ttMove) {
            return 1000000000;
        }

        let moveScoreGuess = 0;

        const from = MoveUtils.getSourceSquare(move);
        const to = MoveUtils.getTargetSquare(move);

        const movePiece = board.getPieceOnSquare(from);
        const capturedPiece = board.getPieceOnSquare(to);

        const movePieceType = PieceUtils.getType(movePiece);
        const capturedPieceType = PieceUtils.getType(capturedPiece);
        
        const fromSquareEval = board.sideToMove === Piece.Black ? Evaluation.pieceSquareTables[movePieceType]![from]! : Evaluation.pieceSquareTables[movePieceType]![from ^ 56]!;
        const toSquareEval = board.sideToMove === Piece.Black ? Evaluation.pieceSquareTables[movePieceType]![to]! : Evaluation.pieceSquareTables[movePieceType]![to ^ 56]!;

        moveScoreGuess += toSquareEval - fromSquareEval;

        if (capturedPieceType !== Piece.None) {
            const capturedPieceValue = this.getPieceValue(capturedPieceType);
            const movePieceValue = this.getPieceValue(movePieceType);
            const toBB = 1n << BigInt(to);

            if ((protectedSquares & toBB) !== 0n) {
                if (capturedPieceValue >= movePieceValue) {
                    moveScoreGuess += (5 * capturedPieceValue) - movePieceValue;
                } else {
                    moveScoreGuess += capturedPieceValue - movePieceValue;
                }
            } else {
                moveScoreGuess += (10 * capturedPieceValue) - movePieceValue;
            }
        }

        if (MoveUtils.isPromotion(move)) {
            moveScoreGuess += this.getPieceValue(MoveUtils.getPromotionPieceType(move));
        }

        //passed pawns
        if (movePieceType === Piece.Pawn) {
            if (this.isPassedPawn(board, to)) {
                const rank = to >> 3;
                const advancement = board.sideToMove === Piece.White ? 7 - rank : rank;
                moveScoreGuess += advancement * advancement * 15;
            }
        }

        if ((opponentPawnAttacks & (1n << BigInt(to))) !== 0n) {
            moveScoreGuess -= this.getPieceValue(movePieceType);
        }

        if (capturedPieceType === Piece.None && (protectedSquares & (1n << BigInt(to))) !== 0n) {
            moveScoreGuess -= 50;
        }
        
        return moveScoreGuess
    }

    private static isPassedPawn(board: Board, square: number): boolean {
        const file = square % 8;
        const rank = Math.floor(square / 8);
        
        const opponentColor = board.sideToMove ^ Piece.ColorMask;
        const opponentPawns = board.bitboards[Piece.Pawn | opponentColor] || 0n;
        
        let maskSquares = 0n;
        
        if (board.sideToMove === Piece.White) {
            // White pawns move up (decreasing rank)
            for (let r = rank - 1; r >= 0; r--) {
                if (file > 0) maskSquares |= 1n << BigInt(r * 8 + file - 1);
                maskSquares |= 1n << BigInt(r * 8 + file);
                if (file < 7) maskSquares |= 1n << BigInt(r * 8 + file + 1);
            }
        } else {
            // Black pawns move down (increasing rank)
            for (let r = rank + 1; r < 8; r++) {
                if (file > 0) maskSquares |= 1n << BigInt(r * 8 + file - 1);
                maskSquares |= 1n << BigInt(r * 8 + file);
                if (file < 7) maskSquares |= 1n << BigInt(r * 8 + file + 1);
            }
        }
        
        return (opponentPawns & maskSquares) === 0n;
    }

    private static getPieceValue(piece: Piece): number {
        return Evaluation.pieceValues[PieceUtils.getType(piece)] || 0;
    }


    public static getProtectedSquares(board: Board, color: Piece.White | Piece.Black): bigint {
        let protectedSquares = 0n;
        const occupied = board.allPieces;

        const opponentPawns = board.bitboards[Piece.Pawn | color] || 0n;    
        protectedSquares |= color === Piece.White ? Attacks.blackPawnAttacksFromBitboard(opponentPawns) : Attacks.blackPawnAttacksFromBitboard(opponentPawns);

        let opponentKnights = board.bitboards[Piece.Knight | color] || 0n;
        while (opponentKnights !== 0n) {
            const knightSquare = Evaluation.getLSBIndex(opponentKnights);
            protectedSquares |= Attacks.knightAttacks[knightSquare]!;
            opponentKnights &= opponentKnights - 1n;
        }


        let opponentBishops = board.bitboards[Piece.Bishop | color] || 0n;
        while (opponentBishops !== 0n) {
            const bishopSquare = Evaluation.getLSBIndex(opponentBishops);
            protectedSquares |= Attacks.getBishopAttacks(bishopSquare, occupied);
            opponentBishops &= opponentBishops - 1n;
        }
        
        let opponentRooks = board.bitboards[Piece.Rook | color] || 0n;
        while (opponentRooks !== 0n) {
            const rookSquare = Evaluation.getLSBIndex(opponentRooks);
            protectedSquares |= Attacks.getRookAttacks(rookSquare, occupied);
            opponentRooks &= opponentRooks - 1n;
        }

        let opponentQueens = board.bitboards[Piece.Queen | color] || 0n;
        while (opponentQueens !== 0n) {
            const queenSquare = Evaluation.getLSBIndex(opponentQueens);
            protectedSquares |= Attacks.getQueenAttacks(queenSquare, occupied);
            opponentQueens &= opponentQueens - 1n;
        }

        let opponentKing = board.bitboards[Piece.King | color] || 0n;
        if (opponentKing !== 0n) {
            const kingSquare = Evaluation.getLSBIndex(opponentKing);
            protectedSquares |= Attacks.kingAttacks[kingSquare]!;
        }
        
        return protectedSquares;
    }

}