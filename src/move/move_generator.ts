import { Board, BoardUtils, Castling } from "../board/board";
import { Piece, PieceUtils } from "../board/piece";
import { Attacks } from "./attacks";
import { Move, MoveFlag, MoveUtils, squareToString } from "./move";

export class MoveGenerator {
    private board: Board;

    constructor(board: Board) {
        this.board = board;
    }

    public generateLegalMoves(color: number): Move[] {
        const pseudoLegalMoves = this.generatePseudoLegalMoves(color);
        const legalMoves: Move[] = [];

        for (const move of pseudoLegalMoves) {
            this.board.makeMove(move);
            if (!this.isSquareAttacked(this.getKingSquare(color), color ^ Piece.ColorMask)) {
                legalMoves.push(move);
            }
            this.board.unmakeMove(move);
        }

        return legalMoves;
    }

    public generatePseudoLegalMoves(color: number): Move[] {
        const moves: Move[] = [];
    
        this.generateKingMoves(moves, color);
        this.generateKnightMoves(moves, color);
        this.generatePawnMoves(moves, color);
        this.generateBishopMoves(moves, color);
        this.generateRookMoves(moves, color);
        this.generateQueenMoves(moves, color);
        this.generateCastleMoves(moves, color);

        return moves;
    }

    private generatePawnMoves(moves: Move[], color: number): void {
        const pawnBitboard = this.board.bitboards[color | Piece.Pawn];
        const friendlyPieces = (color === Piece.White) ? this.board.whitePieces : this.board.blackPieces;
        const enemyPieces = (color === Piece.White) ? this.board.blackPieces : this.board.whitePieces;
        const emptySquares = ~(this.board.allPieces);
        const direction = (color === Piece.White) ? 8 : -8;
        const startingRank = (color === Piece.White) ? 1 : 6;
        const promotionRank = (color === Piece.White) ? 6 : 1;

        let pawns = pawnBitboard;

        while (pawns !== 0n) {
            const square = Attacks.getLSB(pawns!);
            pawns = Attacks.popLSB(pawns!);

            const rank = square >> 3;
            const file = square & 7;
            const targetSquare = square + direction;
            const targetMask = 1n << BigInt(targetSquare);

            // single push
            if (targetSquare >= 0 && targetSquare < 64 && (emptySquares & targetMask) !== 0n) {
                if (rank === promotionRank) {
                    for (let promoFlag = MoveFlag.PromotionToKnight; promoFlag <= MoveFlag.PromotionToQueen; promoFlag++) {
                        const move = MoveUtils.encode(square, targetSquare, promoFlag);
                        moves.push(move);
                    }
                }
                else {
                    const move = MoveUtils.encode(square, targetSquare, MoveFlag.Quiet);
                    moves.push(move);
                }

                // double push
                if (rank === startingRank) {
                    const doublePushSquare = square + 2 * direction;
                    const doublePushMask = 1n << BigInt(doublePushSquare);
                    const betweenSquare = square + direction;
                    const betweenMask = 1n << BigInt(betweenSquare);

                    if ((emptySquares & doublePushMask) !== 0n && (emptySquares & betweenMask) !== 0n) {
                        const move = MoveUtils.encode(square, doublePushSquare, MoveFlag.DoublePawnPush);
                        moves.push(move);
                    }
                }
            }

            // captures
            const attacks = (color === Piece.White) ? Attacks.whitePawnAttacks[square]! : Attacks.blackPawnAttacks[square]!;
            let validCaptures = attacks & enemyPieces;

            while (validCaptures !== 0n) {
                const captureSquare = Attacks.getLSB(validCaptures);
                validCaptures = Attacks.popLSB(validCaptures);

                if (rank === promotionRank) {
                    for (let promoFlag = MoveFlag.PromotionToKnightCapture; promoFlag <= MoveFlag.PromotionToQueenCapture; promoFlag++) {
                        const move = MoveUtils.encode(square, captureSquare, promoFlag);
                        moves.push(move);
                    }
                }
                else {
                    const move = MoveUtils.encode(square, captureSquare, MoveFlag.Capture);
                    moves.push(move);
                }
            }

            // en passant
            const enPassantSquare = BoardUtils.getEnPassantSquare(this.board);
            if (enPassantSquare !== -1) {
                const enPassantMask = 1n << BigInt(enPassantSquare);
                if ((attacks & enPassantMask) !== 0n) {
                    const move = MoveUtils.encode(square, enPassantSquare, MoveFlag.EnPassant);
                    moves.push(move);
                }
            }
        }
    }

    private generateKnightMoves(moves: Move[], color: number): void {
        const knightBitboard = this.board.bitboards[color | Piece.Knight];
        const friendlyPieces = (color === Piece.White) ? this.board.whitePieces : this.board.blackPieces;
        const enemyPieces = (color === Piece.White) ? this.board.blackPieces : this.board.whitePieces;

        let knights = knightBitboard;

        while (knights !== 0n) {
            const square = Attacks.getLSB(knights!);
            knights = Attacks.popLSB(knights!);
            
            const attacks = Attacks.knightAttacks[square]! & ~friendlyPieces;
            let validMoves = attacks;

            while (validMoves !== 0n) {
                const targetSquare = Attacks.getLSB(validMoves);
                validMoves = Attacks.popLSB(validMoves);
                
                const isCapture = (enemyPieces & (1n << BigInt(targetSquare))) !== 0n;
                const flag = isCapture ? MoveFlag.Capture : MoveFlag.Quiet;
                const move = MoveUtils.encode(square, targetSquare, flag);
                moves.push(move);
            }
        }
    }

    private generateKingMoves(moves: Move[], color: number): void {
        const kingBitboard = this.board.bitboards[color | Piece.King];
        const friendlyPieces = (color === Piece.White) ? this.board.whitePieces : this.board.blackPieces;
        const enemyPieces = (color === Piece.White) ? this.board.blackPieces : this.board.whitePieces;

        if (kingBitboard === 0n) return;

        const square = Attacks.getLSB(kingBitboard!);
        const attacks = Attacks.kingAttacks[square]! & ~friendlyPieces;
        let validMoves = attacks;

        while (validMoves !== 0n) {
            const targetSquare = Attacks.getLSB(validMoves);
            validMoves = Attacks.popLSB(validMoves);

            const isCapture = (enemyPieces & (1n << BigInt(targetSquare))) !== 0n;
            const flag = isCapture ? MoveFlag.Capture : MoveFlag.Quiet;
            
            const move = MoveUtils.encode(square, targetSquare, flag);
            moves.push(move);
        }
    }

    private generateBishopMoves(moves: Move[], color: number): void {
        this.generateSlidingMoves(moves, color, Piece.Bishop);
    }

    private generateRookMoves(moves: Move[], color: number): void {
        this.generateSlidingMoves(moves, color, Piece.Rook);
    }

    private generateQueenMoves(moves: Move[], color: number): void {
        this.generateSlidingMoves(moves, color, Piece.Queen);
    }

    private generateSlidingMoves(moves: Move[], color: number, pieceType: Piece): void {
        const pieceBitboard = this.board.bitboards[color | pieceType];
        const friendlyPieces = (color === Piece.White) ? this.board.whitePieces : this.board.blackPieces;
        const enemyPieces = (color === Piece.White) ? this.board.blackPieces : this.board.whitePieces;

        let pieces = pieceBitboard;

        while (pieces !== 0n) {
            const square = Attacks.getLSB(pieces!);
            pieces = Attacks.popLSB(pieces!);
            
            let attacks: bigint;
            switch (pieceType) {
                case Piece.Bishop:
                    attacks = Attacks.getBishopAttacks(square, this.board.allPieces);
                    break;
                case Piece.Rook:
                    attacks = Attacks.getRookAttacks(square, this.board.allPieces);
                    break;
                case Piece.Queen:
                    attacks = Attacks.getQueenAttacks(square, this.board.allPieces);
                    break;
                default:
                    attacks = 0n;
            }

            let validMoves = attacks & ~friendlyPieces;

            while (validMoves !== 0n) {
                const targetSquare = Attacks.getLSB(validMoves);
                validMoves = Attacks.popLSB(validMoves);
                
                const isCapture = (enemyPieces & (1n << BigInt(targetSquare))) !== 0n;
                const flag = isCapture ? MoveFlag.Capture : MoveFlag.Quiet;
                const move = MoveUtils.encode(square, targetSquare, flag);
                moves.push(move);
            }
        }

    }

    private generateCastleMoves(moves: Move[], color: number): void {
        const castlingRights = BoardUtils.getCastlingRights(this.board);
        const kingSquare = this.getKingSquare(color);

        if (kingSquare == -1) return;

        // check
        if (this.isSquareAttacked(kingSquare, color ^ Piece.ColorMask)) {
            return;
        }

        if (color === Piece.White) {
            // kingside e1 to g1
            if ((castlingRights & Castling.WK) !== 0) { // existing right
                if ((this.board.allPieces & 0x60n) === 0n) { // squares between empty

                    if (!this.isSquareAttacked(5, Piece.Black) && !this.isSquareAttacked(6, Piece.Black)) { // squares not attacked
                        const move = MoveUtils.encode(4, 6, MoveFlag.KingCastle);
                        moves.push(move);
                    }
                }
            }

            // queenside e1 to c1
            if ((castlingRights & Castling.WQ) !== 0) { // existing right
                if ((this.board.allPieces & 0xEn) === 0n) { // squares between empty

                    if (!this.isSquareAttacked(3, Piece.Black) && !this.isSquareAttacked(2, Piece.Black)) { // squares not attacked
                        const move = MoveUtils.encode(4, 2, MoveFlag.QueenCastle);
                        moves.push(move);
                    }
                }
            }
        } else {
            // kingside e8 to g8
            if ((castlingRights & Castling.BK) !== 0) { // existing right
                if ((this.board.allPieces & 0x6000000000000000n) === 0n) { // squares between empty
                    
                    if (!this.isSquareAttacked(61, Piece.White) && !this.isSquareAttacked(62, Piece.White)) { // squares not attacked
                        const move = MoveUtils.encode(60, 62, MoveFlag.KingCastle);
                        moves.push(move);
                    }
                }
            }

            // queenside e8 to c8
            if ((castlingRights & Castling.BQ) !== 0) { // existing right
                if ((this.board.allPieces & 0xE00000000000000n) === 0n) { // squares between empty

                    if (!this.isSquareAttacked(59, Piece.White) && !this.isSquareAttacked(58, Piece.White)) { // squares not attacked
                        const move = MoveUtils.encode(60, 58, MoveFlag.QueenCastle);
                        moves.push(move);
                    }
                }
            }
        }

    }


    private getKingSquare(color: number): number {
        const kingBitboard = this.board.bitboards[color | Piece.King]!;
        if (kingBitboard === 0n) return -1;

        return Attacks.getLSB(kingBitboard);
    }

    private isSquareAttacked(square: number, byColor: number): boolean {
        if (square < 0 || square > 63) {
            throw new Error("please noooo");
        }
        // pawn attacks
        const pawnAttacks = byColor === Piece.White ? Attacks.blackPawnAttacks[square]! : Attacks.whitePawnAttacks[square]!;
        if ((pawnAttacks & this.board.bitboards[byColor | Piece.Pawn]!) !== 0n) {
            return true;
        }

        //knight attacks
        if ((Attacks.knightAttacks[square]! & this.board.bitboards[byColor | Piece.Knight]!) !== 0n) {
            return true;
        }

        //king attacks
        if ((Attacks.kingAttacks[square]! & this.board.bitboards[byColor | Piece.King]!) !== 0n) {
            return true;
        }

        //bishop/queen attacks
        const bishopAttacks = Attacks.getBishopAttacks(square, this.board.allPieces);
        if ((bishopAttacks & (this.board.bitboards[byColor | Piece.Bishop]! | this.board.bitboards[byColor | Piece.Queen]!)) !== 0n) {
            return true;
        }

        //rook/queen attacks
        const rookAttacks = Attacks.getRookAttacks(square, this.board.allPieces);
        if ((rookAttacks & (this.board.bitboards[byColor | Piece.Rook]! | this.board.bitboards[byColor | Piece.Queen]!)) !== 0n) {
            return true;
        }

        return false;
    }

    public isKingInCheck(side: Piece.Black | Piece.White): boolean {
        const kingSquare = this.getKingSquare(side);
        return this.isSquareAttacked(kingSquare, side ^ Piece.ColorMask);
    }

    public createMoveWithContext(source: number, target: number): Move {
        const targetMask = 1n << BigInt(target);
        
        const movingPiece = this.board.getPieceOnSquare(source);
        const pieceType = PieceUtils.getType(movingPiece);

        const sourceRank = source >> 3;
        const targetRank = target >> 3;

        const isCapture = (this.board.sideToMove === Piece.White ? (this.board.blackPieces & targetMask) : (this.board.whitePieces & targetMask)) !== 0n;
        const isPawnPromotion = pieceType === Piece.Pawn && ((this.board.sideToMove === Piece.White && targetRank === 7) || (this.board.sideToMove === Piece.Black && targetRank === 0));
        const isDoublePawnPush = pieceType === Piece.Pawn && Math.abs(targetRank - sourceRank) === 2;
        const isEnPassant = pieceType === Piece.Pawn && target === BoardUtils.getEnPassantSquare(this.board);
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