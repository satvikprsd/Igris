import { Board } from "../board/board";
import { Piece, PieceUtils } from "../board/piece";
import { Attacks } from "../move/attacks";
import { Move, MoveUtils } from "../move/move";
import { Evaluation } from "./evaluation";

export class MoveOrdering {
    public static orderMoves(board: Board, moves: Move[]): Move[] {
        const opponentPawnAttacks = board.sideToMove === Piece.White ? Attacks.blackPawnAttacksFromBitboard(board.bitboards[Piece.Pawn | Piece.Black]!) : Attacks.whitePawnAttacksFromBitboard(board.bitboards[Piece.Pawn | Piece.White]!);

        const scored = moves.map(move => ({move, score: this.scoreMove(board, move, opponentPawnAttacks)}));

        scored.sort((a, b) => b.score - a.score);

        for (let i = 0; i < moves.length; i++) {
            moves[i] = scored[i]!.move;
        }

        return moves;
    }

    private static scoreMove(board: Board, move: Move, opponentPawnAttacks: bigint): number {
        let moveScoreGuess = 0;

        const from = MoveUtils.getSourceSquare(move);
        const to = MoveUtils.getTargetSquare(move);

        const movePieceType = board.getPieceOnSquare(from);
        const capturedPieceType = board.getPieceOnSquare(to);

        if (capturedPieceType !== Piece.None) {
            const capturedPieceValue = this.getPieceValue(capturedPieceType);
            const movePieceValue = this.getPieceValue(movePieceType);
            if (capturedPieceValue >= movePieceValue) {
                moveScoreGuess += 1000 + 10*capturedPieceValue - movePieceValue;
            }
            else if ((opponentPawnAttacks & (1n << BigInt(to))) !== 0n) {
                moveScoreGuess += 10*capturedPieceValue - movePieceValue - 1000;
            }
            else {
                moveScoreGuess += 10*capturedPieceValue - movePieceValue;
            }
            
        }
        else if (MoveUtils.isPromotion(move)) {
            moveScoreGuess += 800;
        }
        else {
            if ((opponentPawnAttacks & (1n << BigInt(to))) !== 0n) {
                moveScoreGuess -= this.getPieceValue(movePieceType)/10;
            }
        }
        
        return moveScoreGuess
    }

    private static getPieceValue(piece: Piece): number {
        return Evaluation.pieceValues[PieceUtils.getType(piece)] || 0;
    }
}