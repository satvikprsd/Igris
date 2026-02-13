import { Board, BoardUtils, Castling } from "../board/board";
import { Piece, PieceUtils } from "../board/piece";
import { Evaluation } from "../engine/evaluation";
import { Attacks } from "./attacks";
import { Move, MoveFlag, MoveUtils, squareToString } from "./move";

export class MoveGenerator {
    private board: Board;
    private moveBuffer: number[] = new Array(256);
    private moveCount: number = 0;

    constructor(board: Board) {
        this.board = board;
    }

    public generateLegalMoves(color: number, onlyCaptures?: boolean): Move[] {
        this.moveCount = 0;
        this.generatePseudoLegalMoves(color);
    
        let legalCount = 0;
        for (let i = 0; i < this.moveCount; i++) {
            const move = this.moveBuffer[i]!;
            
            if (onlyCaptures) {
                const flag = MoveUtils.getMoveFlag(move);
                const isCapture = flag === MoveFlag.Capture || flag === MoveFlag.EnPassant || flag >= MoveFlag.PromotionToKnightCapture;
                if (!isCapture) continue;
                
                const capturedPieceType = this.board.getPieceOnSquare(MoveUtils.getTargetSquare(move));
                const movePieceType = this.board.getPieceOnSquare(MoveUtils.getSourceSquare(move));
                const isGoodCapture = (PieceUtils.getType(capturedPieceType) >= Piece.Queen) || 
                    (Evaluation.pieceValues[PieceUtils.getType(capturedPieceType)]! > Evaluation.pieceValues[PieceUtils.getType(movePieceType)]!);
                if (!isGoodCapture) continue;
            }

            this.board.makeMove(move);
            const isLegal = !this.isSquareAttacked(this.getKingSquare(color), color ^ Piece.ColorMask);
            this.board.unmakeMove(move);
            
            if (isLegal) {
                this.moveBuffer[legalCount++] = move;
            }
        }

        return this.moveBuffer.slice(0, legalCount);
    }

    private generatePseudoLegalMoves(color: number): void {
        this.generateKingMoves(color);
        this.generateKnightMoves(color);
        this.generatePawnMoves(color);
        this.generateBishopMoves(color);
        this.generateRookMoves(color);
        this.generateQueenMoves(color);
        this.generateCastleMoves(color);
    }
    
    private addMove(move: number): void {
        this.moveBuffer[this.moveCount++] = move;
    }

    private generatePawnMoves(color: number): void {
        const pawnBitboard = this.board.bitboards[color | Piece.Pawn];
        const friendlyPieces = (color === Piece.White) ? this.board.whitePieces : this.board.blackPieces;
        const enemyPieces = (color === Piece.White) ? this.board.blackPieces : this.board.whitePieces;
        const emptySquares = ~(this.board.allPieces);
        const direction = (color === Piece.White) ? 8 : -8;
        const startingRank = (color === Piece.White) ? 1 : 6;
        const promotionRank = (color === Piece.White) ? 6 : 1;
        
        const enPassantSquare = BoardUtils.getEnPassantSquare(this.board);

        let pawns = pawnBitboard!;

        while (pawns !== 0n) {
            const square = Attacks.getLSB(pawns);
            pawns = Attacks.popLSB(pawns);

            const rank = square >> 3;
            const targetSquare = square + direction;
            const targetMask = 1n << BigInt(targetSquare);

            // single push
            if (targetSquare >= 0 && targetSquare < 64 && (emptySquares & targetMask) !== 0n) {
                if (rank === promotionRank) {
                    this.addMove(MoveUtils.encode(square, targetSquare, MoveFlag.PromotionToKnight));
                    this.addMove(MoveUtils.encode(square, targetSquare, MoveFlag.PromotionToBishop));
                    this.addMove(MoveUtils.encode(square, targetSquare, MoveFlag.PromotionToRook));
                    this.addMove(MoveUtils.encode(square, targetSquare, MoveFlag.PromotionToQueen));
                } else {
                    this.addMove(MoveUtils.encode(square, targetSquare, MoveFlag.Quiet));
                }

                // double push
                if (rank === startingRank) {
                    const doublePushSquare = square + 2 * direction;
                    const doublePushMask = 1n << BigInt(doublePushSquare);

                    if ((emptySquares & doublePushMask) !== 0n) {
                        this.addMove(MoveUtils.encode(square, doublePushSquare, MoveFlag.DoublePawnPush));
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
                    this.addMove(MoveUtils.encode(square, captureSquare, MoveFlag.PromotionToKnightCapture));
                    this.addMove(MoveUtils.encode(square, captureSquare, MoveFlag.PromotionToBishopCapture));
                    this.addMove(MoveUtils.encode(square, captureSquare, MoveFlag.PromotionToRookCapture));
                    this.addMove(MoveUtils.encode(square, captureSquare, MoveFlag.PromotionToQueenCapture));
                } else {
                    this.addMove(MoveUtils.encode(square, captureSquare, MoveFlag.Capture));
                }
            }

            // en passant
            if (enPassantSquare !== -1) {
                const enPassantMask = 1n << BigInt(enPassantSquare);
                if ((attacks & enPassantMask) !== 0n) {
                    this.addMove(MoveUtils.encode(square, enPassantSquare, MoveFlag.EnPassant));
                }
            }
        }
    }

    private generateKnightMoves(color: number): void {
        const knightBitboard = this.board.bitboards[color | Piece.Knight];
        const friendlyPieces = (color === Piece.White) ? this.board.whitePieces : this.board.blackPieces;
        const enemyPieces = (color === Piece.White) ? this.board.blackPieces : this.board.whitePieces;

        let knights = knightBitboard!;

        while (knights !== 0n) {
            const square = Attacks.getLSB(knights);
            knights = Attacks.popLSB(knights);
            
            const attacks = Attacks.knightAttacks[square]! & ~friendlyPieces;
            let validMoves = attacks;

            while (validMoves !== 0n) {
                const targetSquare = Attacks.getLSB(validMoves);
                validMoves = Attacks.popLSB(validMoves);
                
                const targetBit = 1n << BigInt(targetSquare);
                const flag = (enemyPieces & targetBit) !== 0n ? MoveFlag.Capture : MoveFlag.Quiet;
                this.addMove(MoveUtils.encode(square, targetSquare, flag));
            }
        }
    }

    private generateKingMoves(color: number): void {
        const kingBitboard = this.board.bitboards[color | Piece.King]!;
        const friendlyPieces = (color === Piece.White) ? this.board.whitePieces : this.board.blackPieces;
        const enemyPieces = (color === Piece.White) ? this.board.blackPieces : this.board.whitePieces;

        if (kingBitboard === 0n) return;

        const square = Attacks.getLSB(kingBitboard);
        const attacks = Attacks.kingAttacks[square]! & ~friendlyPieces;
        let validMoves = attacks;

        while (validMoves !== 0n) {
            const targetSquare = Attacks.getLSB(validMoves);
            validMoves = Attacks.popLSB(validMoves);

            const targetBit = 1n << BigInt(targetSquare);
            const flag = (enemyPieces & targetBit) !== 0n ? MoveFlag.Capture : MoveFlag.Quiet;
            this.addMove(MoveUtils.encode(square, targetSquare, flag));
        }
    }

    private generateBishopMoves(color: number): void {
        this.generateSlidingMoves(color, Piece.Bishop);
    }

    private generateRookMoves(color: number): void {
        this.generateSlidingMoves(color, Piece.Rook);
    }

    private generateQueenMoves(color: number): void {
        this.generateSlidingMoves(color, Piece.Queen);
    }

    private generateSlidingMoves(color: number, pieceType: number): void {
        const pieceBitboard = this.board.bitboards[color | pieceType];
        const friendlyPieces = (color === Piece.White) ? this.board.whitePieces : this.board.blackPieces;
        const enemyPieces = (color === Piece.White) ? this.board.blackPieces : this.board.whitePieces;
        
        const occupied = this.board.allPieces;

        let pieces = pieceBitboard!;

        while (pieces !== 0n) {
            const square = Attacks.getLSB(pieces);
            pieces = Attacks.popLSB(pieces);

            let attacks: bigint;
            
            if (pieceType === Piece.Bishop) {
                attacks = Attacks.getBishopAttacks(square, occupied);
            } else if (pieceType === Piece.Rook) {
                attacks = Attacks.getRookAttacks(square, occupied);
            } else { // Queen
                attacks = Attacks.getQueenAttacks(square, occupied);
            }
            
            let validMoves = attacks & ~friendlyPieces;

            while (validMoves !== 0n) {
                const targetSquare = Attacks.getLSB(validMoves);
                validMoves = Attacks.popLSB(validMoves);
                
                const targetBit = 1n << BigInt(targetSquare);
                const flag = (enemyPieces & targetBit) !== 0n ? MoveFlag.Capture : MoveFlag.Quiet;
                this.addMove(MoveUtils.encode(square, targetSquare, flag));
            }
        }
    }

    private generateCastleMoves(color: number): void {
        const kingSquare = this.getKingSquare(color);
        if (this.isSquareAttacked(kingSquare, color ^ Piece.ColorMask)) {
            return;
        }

        const castlingRights = BoardUtils.getCastlingRights(this.board);

        if (color === Piece.White) {
            // kingside e1 to g1
            if ((castlingRights & Castling.WK) !== 0) { // existing right
                if ((this.board.allPieces & 0x60n) === 0n) { // squares between empty
                    if (!this.isSquareAttacked(5, Piece.Black) && !this.isSquareAttacked(6, Piece.Black)) {
                        this.addMove(MoveUtils.encode(4, 6, MoveFlag.KingCastle));
                    }
                }
            }

            // queenside e1 to c1
            if ((castlingRights & Castling.WQ) !== 0) { // existing right
                if ((this.board.allPieces & 0xEn) === 0n) { // squares between empty
                    if (!this.isSquareAttacked(3, Piece.Black) && !this.isSquareAttacked(2, Piece.Black)) {
                        this.addMove(MoveUtils.encode(4, 2, MoveFlag.QueenCastle));
                    }
                }
            }
        } else {
            // kingside e8 to g8
            if ((castlingRights & Castling.BK) !== 0) { // existing right
                if ((this.board.allPieces & 0x6000000000000000n) === 0n) { // squares between empty
                    if (!this.isSquareAttacked(61, Piece.White) && !this.isSquareAttacked(62, Piece.White)) {
                        this.addMove(MoveUtils.encode(60, 62, MoveFlag.KingCastle));
                    }
                }
            }

            // queenside e8 to c8
            if ((castlingRights & Castling.BQ) !== 0) { // existing right
                if ((this.board.allPieces & 0xE00000000000000n) === 0n) { // squares between empty
                    if (!this.isSquareAttacked(59, Piece.White) && !this.isSquareAttacked(58, Piece.White)) {
                        this.addMove(MoveUtils.encode(60, 58, MoveFlag.QueenCastle));
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
            throw new Error("Invalid square");
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

        const occupied = this.board.allPieces;

        //bishop/queen attacks
        const bishopAttacks = Attacks.getBishopAttacks(square, occupied);
        if ((bishopAttacks & (this.board.bitboards[byColor | Piece.Bishop]! | this.board.bitboards[byColor | Piece.Queen]!)) !== 0n) {
            return true;
        }

        //rook/queen attacks
        const rookAttacks = Attacks.getRookAttacks(square, occupied);
        if ((rookAttacks & (this.board.bitboards[byColor | Piece.Rook]! | this.board.bitboards[byColor | Piece.Queen]!)) !== 0n) {
            return true;
        }

        return false;
    }

    public isKingInCheck(side: Piece.Black | Piece.White): boolean {
        const kingSquare = this.getKingSquare(side);
        return this.isSquareAttacked(kingSquare, side ^ Piece.ColorMask);
    }

    public  createMoveWithContext(source: number, target: number): Move {
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

        // console.log(`Creating move from ${squareToString(source)} to ${squareToString(target)} with flag ${MoveFlag[flag]}`);
        return MoveUtils.encode(source, target, flag);
    }

    public generateAttacksForSide(color: number): bigint {
        let attacks = 0n;
        const friendlyPieces = (color === Piece.White) ? this.board.whitePieces : this.board.blackPieces;
        const occupied = this.board.allPieces;

        for (let pieceType = Piece.Pawn; pieceType <= Piece.King; pieceType++) {
            const pieceBitboard = this.board.bitboards[color | pieceType];
            let pieces = pieceBitboard!;

            while (pieces !== 0n) {
                const square = Attacks.getLSB(pieces);
                pieces = Attacks.popLSB(pieces);

                let pieceAttacks: bigint;
                switch (pieceType) {
                    case Piece.Pawn:
                        pieceAttacks = (color === Piece.White) ? Attacks.whitePawnAttacks[square]! : Attacks.blackPawnAttacks[square]!;
                        break;
                    case Piece.Knight:
                        pieceAttacks = Attacks.knightAttacks[square]!;
                        break;
                    case Piece.Bishop:
                        pieceAttacks = Attacks.getBishopAttacks(square, occupied);
                        break;
                    case Piece.Rook:
                        pieceAttacks = Attacks.getRookAttacks(square, occupied);
                        break;
                    case Piece.Queen:
                        pieceAttacks = Attacks.getQueenAttacks(square, occupied);
                        break;
                    case Piece.King:
                        pieceAttacks = Attacks.kingAttacks[square]!;
                        break;
                    default:
                        pieceAttacks = 0n;
                }

                attacks |= pieceAttacks;
            }
        }

        return attacks & ~friendlyPieces;
    }

    public generatePawnAttacksForSide(color: number): bigint {
        let attacks = 0n;
        const pawnBitboard = this.board.bitboards[color | Piece.Pawn];
        
        let pawns = pawnBitboard!;
        while (pawns !== 0n) {
            const square = Attacks.getLSB(pawns);
            pawns = Attacks.popLSB(pawns);
            
            const pawnAttacks = (color === Piece.White) ? Attacks.whitePawnAttacks[square]! : Attacks.blackPawnAttacks[square]!;
            attacks |= pawnAttacks;
        }
        
        return attacks;
    }
}