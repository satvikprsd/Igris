import { Move, MoveFlag, MoveUtils } from "../move/move";
import { Piece, PieceUtils } from "./piece";


export enum Castling {
  WK = 1,  // White kingside
  WQ = 2,  // White queenside
  BK = 4,  // Black kingside
  BQ = 8,  // Black queenside
}

export const startFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";



export class Board {
    public bitboards: bigint[];
    public whitePieces: bigint = 0n;
    public blackPieces: bigint = 0n;
    public allPieces: bigint = 0n;
    public sideToMove: Piece.White | Piece.Black = Piece.White;
    public currentGameState: number = 0;
    public gameStateHistory: number[] = [];
    // 0000 0000 000000 0000
    // castlingRights enPassantSquare capturedPiece halfmoveClock

    constructor() {
        this.bitboards = new Array<bigint>(15).fill(0n);     
        this.loadPositionFromFen(startFEN);
    }

    setBit(piece: Piece, square: number): void {
        this.bitboards[piece]! |= (1n << BigInt(square));
    }

    popBit(piece: Piece, square: number): void {
        this.bitboards[piece]! &= ~(1n << BigInt(square));
    }

    updateOccupancies(): void {
        this.whitePieces = 0n;
        this.blackPieces = 0n;
        for (let piece = Piece.White | Piece.King; piece <= (Piece.White | Piece.Queen); piece++) {
            this.whitePieces |= this.bitboards[piece]!;
        }
        for (let piece = Piece.Black | Piece.King; piece <= (Piece.Black | Piece.Queen); piece++) {
            this.blackPieces |= this.bitboards[piece]!;
        }
        this.allPieces = this.whitePieces | this.blackPieces;
    }
    
    clearBoard(): void {
        this.bitboards.fill(0n);
        this.whitePieces = 0n;
        this.blackPieces = 0n;
        this.allPieces = 0n;
        this.currentGameState = 0;
        this.sideToMove = Piece.White;
        this.gameStateHistory = [];
    }

    getPieceOnSquare(square: number): Piece {
        const squareMask = 1n << BigInt(square);
        for (let piece = 0; piece < this.bitboards.length; piece++) {
            if ((this.bitboards[piece]! & squareMask) !== 0n) {
                return piece as Piece;
            }
        }
        return Piece.None;
    }

    makeMove(move: Move): void {
        const source = MoveUtils.getSourceSquare(move);
        const target = MoveUtils.getTargetSquare(move);
        const flag = MoveUtils.getMoveFlag(move);
        const movingPiece = this.getPieceOnSquare(source);

        // console.log(this.currentGameState);
        this.gameStateHistory.push(this.currentGameState);
        
        this.currentGameState &= ~(0b111111 << 8);
        this.currentGameState &= ~BoardUtils.EP_MASK;

        if (flag === MoveFlag.Capture || flag >= MoveFlag.PromotionToKnightCapture) {
            const capturedPiece = this.getPieceOnSquare(target);
            const capturedPieceType = PieceUtils.getType(capturedPiece);
            this.currentGameState |= (capturedPieceType << 8);
            this.popBit(capturedPiece, target);
        }

        if (flag === MoveFlag.EnPassant) {
            const epCaptureSquare = (this.sideToMove === Piece.White) ? target - 8 : target + 8;
            this.currentGameState |= (Piece.Pawn << 8);
            this.popBit(PieceUtils.swapColor(movingPiece), epCaptureSquare);
        }
        
        this.popBit(movingPiece, source);

        switch (flag) {
            case MoveFlag.PromotionToKnight:
            case MoveFlag.PromotionToKnightCapture:
                this.setBit(this.sideToMove | Piece.Knight, target);
                break;
            case MoveFlag.PromotionToBishop:
            case MoveFlag.PromotionToBishopCapture:
                this.setBit(this.sideToMove | Piece.Bishop, target);
                break;
            case MoveFlag.PromotionToRook:
            case MoveFlag.PromotionToRookCapture:
                this.setBit(this.sideToMove | Piece.Rook, target);
                break;
            case MoveFlag.PromotionToQueen:
            case MoveFlag.PromotionToQueenCapture:
                this.setBit(this.sideToMove | Piece.Queen, target);
                break;
            default:
                this.setBit(movingPiece, target);
        }

        if(flag === MoveFlag.KingCastle) {
            this.popBit(this.sideToMove | Piece.Rook, target + 1);
            this.setBit(this.sideToMove | Piece.Rook, target - 1);
        } else if (flag === MoveFlag.QueenCastle) {
            this.popBit(this.sideToMove | Piece.Rook, target - 2);
            this.setBit(this.sideToMove | Piece.Rook, target + 1);
        }
        
        if (flag === MoveFlag.DoublePawnPush) {
            this.currentGameState |= (( (source % 8) + 1) << 4);
        }
        
        let updatedCastlingRights = BoardUtils.getCastlingRights(this);;

        if (PieceUtils.getType(movingPiece) === Piece.King) {
            updatedCastlingRights &= (this.sideToMove === Piece.White) ? ~(Castling.WK | Castling.WQ) : ~(Castling.BK | Castling.BQ);
        }
        
        if (PieceUtils.getType(movingPiece) === Piece.Rook) {
            if (this.sideToMove === Piece.White) {
                if (source === 0) updatedCastlingRights &= ~Castling.WQ;
                if (source === 7) updatedCastlingRights &= ~Castling.WK;
            } else {
                if (source === 56) updatedCastlingRights &= ~Castling.BQ;
                if (source === 63) updatedCastlingRights &= ~Castling.BK;
            }
        }
    
        // If rook is captured
        if (flag === MoveFlag.Capture || flag >= MoveFlag.PromotionToKnightCapture) {
            if (target === 0) updatedCastlingRights &= ~Castling.WQ;
            if (target === 7) updatedCastlingRights &= ~Castling.WK;
            if (target === 56) updatedCastlingRights &= ~Castling.BQ;
            if (target === 63) updatedCastlingRights &= ~Castling.BK;
        }

        this.currentGameState = (this.currentGameState & ~0b1111) | updatedCastlingRights;
        
        this.updateOccupancies();
        this.sideToMove ^= Piece.ColorMask;
    }

    unmakeMove(move: Move): void {
        const source = MoveUtils.getSourceSquare(move);
        const target = MoveUtils.getTargetSquare(move);
        const flag = MoveUtils.getMoveFlag(move);

        this.sideToMove ^= Piece.ColorMask;

        const capturedType = BoardUtils.getCapturedPieceType(this);
        const capturedPiece = capturedType !== Piece.None ? (capturedType | (this.sideToMove ^ Piece.ColorMask)) : Piece.None;

        this.currentGameState = this.gameStateHistory.pop()!;

        if (flag === MoveFlag.KingCastle) {
            this.popBit(this.sideToMove | Piece.Rook, target - 1);
            this.setBit(this.sideToMove | Piece.Rook, target + 1);
        }
        else if (flag === MoveFlag.QueenCastle) {
            this.popBit(this.sideToMove | Piece.Rook, target + 1);
            this.setBit(this.sideToMove | Piece.Rook, target - 2);
        }

        const pieceAtTarget = this.getPieceOnSquare(target);
        const movedPieceType = MoveUtils.isPromotion(move) ? Piece.Pawn | this.sideToMove : pieceAtTarget;

        this.popBit(pieceAtTarget, target);
        this.setBit(movedPieceType, source);

        if (flag === MoveFlag.EnPassant) {
            const epSquare = target + (this.sideToMove === Piece.White ? -8 : 8);
            this.setBit(capturedPiece, epSquare);
        }
        else if (capturedPiece !== Piece.None) {
            this.setBit(capturedPiece, target);
        }

        this.updateOccupancies();
        // console.log(this.currentGameState);
    }

    
    toPieceArray(): string[] {
        const pieceSymbols: { [key: number]: string } = {
            [Piece.White | Piece.Pawn]: 'P',
            [Piece.White | Piece.Knight]: 'N',
            [Piece.White | Piece.Bishop]: 'B',
            [Piece.White | Piece.Rook]: 'R',
            [Piece.White | Piece.Queen]: 'Q',
            [Piece.White | Piece.King]: 'K',
            [Piece.Black | Piece.Pawn]: 'p',
            [Piece.Black | Piece.Knight]: 'n',
            [Piece.Black | Piece.Bishop]: 'b',
            [Piece.Black | Piece.Rook]: 'r',
            [Piece.Black | Piece.Queen]: 'q',
            [Piece.Black | Piece.King]: 'k',
        };

        const boardArray: string[] = new Array(64).fill('.');
        for (let piece = 0; piece < this.bitboards.length; piece++) {
            let bitboard = this.bitboards[piece]!;
            for (let square = 0; square < 64; square++) {
                if ((bitboard & (1n << BigInt(square))) !== 0n) {
                    boardArray[square] = pieceSymbols[piece] || '.';
                }
            }
        }
        return boardArray;
    }
    
    loadPositionFromFen(fen : string): void {
        this.clearBoard();

        const parts = fen.split(' ');
        const fenBoard = parts[0];
        let file = 0;
        let rank = 7;

        for (const char of fenBoard!) {
            if (char === '/') {
                rank--;
                file = 0;
            } else {
                if (isNaN(parseInt(char))) {
                    const piece = this.pieceTypeFromSymbol(char);
                    const square = rank*8 + file;
                    this.setBit(piece, square);
                    file++;
                } else {
                    file += parseInt(char);
                }
            }
        }

        this.updateOccupancies();
        if (parts[1]) {
            this.sideToMove = (parts[1] === 'w') ? Piece.White : Piece.Black;
        }
        if (parts[2]) {
            this.parseCastlingRights(parts[2]);
        }
        if (parts[3] && parts[3] !== '-') {
            this.parseEnPassantSquare(parts[3]);
        }
        if (parts[4]) {
            this.parseHalfmoveClock(parts[4]);
        }
    }

    private pieceTypeFromSymbol(char: string): number {
        const typeMap: {[key: string]: number} = {
            'p': Piece.Pawn, 'n': Piece.Knight, 'b': Piece.Bishop, 
            'r': Piece.Rook, 'q': Piece.Queen, 'k': Piece.King
        };
        const lower = char.toLowerCase();
        const type = typeMap[lower] || Piece.None;
        const color = (char === char.toUpperCase()) ? Piece.White : Piece.Black;
        return type | color;
    }

    private parseCastlingRights(fen: string): void {
        let rights = 0;

        if (fen.includes('K')) rights |= Castling.WK;
        if (fen.includes('Q')) rights |= Castling.WQ;
        if (fen.includes('k')) rights |= Castling.BK;
        if (fen.includes('q')) rights |= Castling.BQ;

        this.currentGameState |= rights;
    }

    private parseEnPassantSquare(fen: string): void {
        const file = fen.charCodeAt(0) - 'a'.charCodeAt(0);
        this.currentGameState |= ((file + 1) << 4);
    }

    private parseHalfmoveClock(fen: string): void {
        const halfmoveClock = parseInt(fen);
        this.currentGameState |= (halfmoveClock << 14);
    }

    public printBoard(): void {
        const boardArray = this.toPieceArray();
        for (let rank = 7; rank >= 0; rank--) {
            let row = '';
            for (let file = 0; file < 8; file++) {
                row += boardArray[rank * 8 + file] + ' ';
            }
            console.log(row);
        }
    }
}


export namespace BoardUtils {
    export const EP_MASK = 0b1111 << 4;

    export function getEnPassantFile(board: Board): number {
        return ((board.currentGameState >> 4) & 0b1111) - 1;
    }

    export function getEnPassantSquare(board: Board): number {
        const file = getEnPassantFile(board);
        if (file < 0 || file > 7) return -1;
        return (board.sideToMove === Piece.White) ? (5 * 8 + file) : (2 * 8 + file);
    }

    export function getCastlingRights(board: Board): number {
        return board.currentGameState & 0b1111;
    }

    export function getHalfmoveClock(board: Board): number {
        return (board.currentGameState >> 14) & 0x3FFFF;
    }

    export function getCapturedPieceType(board: Board): Piece {
        return ((board.currentGameState >> 8) & 0b111111) as Piece;
    }
}