import { Zobrist } from "../engine/zobrist";
import { Move, MoveFlag, MoveUtils } from "../move/move";
import { Piece, PieceUtils } from "./piece";


export enum Castling {
  WK = 1,  // White kingside
  WQ = 2,  // White queenside
  BK = 4,  // Black kingside
  BQ = 8,  // Black queenside
}

export interface GameState {
    zobrist: bigint;
    sideToMove: Piece.White | Piece.Black;
    state : number;
}

export const startFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";



export class Board {
    public bitboards: bigint[];
    public whitePieces: bigint = 0n;
    public blackPieces: bigint = 0n;
    public allPieces: bigint = 0n;
    public sideToMove: Piece.White | Piece.Black = Piece.White;
    public currentGameState: number = 0;
    // 0000 0000 000000 0000
    // castlingRights enPassantSquare capturedPiece halfmoveClock
    public gameStateHistory: GameState[] = [];
    public zobristKey: bigint = 0n;

    constructor() {
        this.bitboards = new Array<bigint>(15).fill(0n);
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
        for (let piece = 1; piece < this.bitboards.length; piece++) {
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
        const oldEnPassantFile = BoardUtils.getEnPassantFile(this);
        const oldCastlingRights = BoardUtils.getCastlingRights(this);

        //remove old zobrist state
        this.zobristKey ^= Zobrist.castlingKeys[oldCastlingRights] || 0n;
        this.zobristKey ^= Zobrist.enPassantKeys[oldEnPassantFile] || 0n;

        // console.log(this.currentGameState);
        this.gameStateHistory.push({
            zobrist: this.zobristKey,
            sideToMove: this.sideToMove,
            state: this.currentGameState
        });
        
        this.currentGameState &= ~(0b111111 << 8);
        this.currentGameState &= ~BoardUtils.EP_MASK;

        let halfmoveClock = BoardUtils.getHalfmoveClock(this);

        if (PieceUtils.getType(movingPiece) === Piece.Pawn || flag === MoveFlag.Capture || flag >= MoveFlag.PromotionToKnightCapture) {
            halfmoveClock = 0;
        } else {
            halfmoveClock += 1;
        }

        this.currentGameState &= ~(0x3FFFF << 14);// clear halfmove clock
        this.currentGameState |= (halfmoveClock << 14);// update halfmove clock

        if (flag === MoveFlag.Capture || flag >= MoveFlag.PromotionToKnightCapture) {
            const capturedPiece = this.getPieceOnSquare(target);
            const capturedPieceType = PieceUtils.getType(capturedPiece);
            this.currentGameState |= (capturedPieceType << 8);
            this.popBit(capturedPiece, target);
            this.zobristKey ^= Zobrist.pieceKeys[capturedPiece]![target] || 0n; // removing captured piece from zobrist
        }

        if (flag === MoveFlag.EnPassant) {
            const epCaptureSquare = (this.sideToMove === Piece.White) ? target - 8 : target + 8;
            this.currentGameState |= (Piece.Pawn << 8);
            this.popBit(PieceUtils.swapColor(movingPiece), epCaptureSquare);
            this.zobristKey ^= Zobrist.pieceKeys[PieceUtils.swapColor(movingPiece)]![epCaptureSquare] || 0n; // removing captured pawn from zobrist
        }
        

        this.zobristKey ^= Zobrist.pieceKeys[movingPiece]![source] || 0n; // remove piece from old square
        this.popBit(movingPiece, source);

        let finalPiece = movingPiece;
        switch (flag) {
            case MoveFlag.PromotionToKnight:
            case MoveFlag.PromotionToKnightCapture:
                finalPiece = this.sideToMove | Piece.Knight;
                break;
            case MoveFlag.PromotionToBishop:
            case MoveFlag.PromotionToBishopCapture:
                finalPiece = this.sideToMove | Piece.Bishop;
                break;
            case MoveFlag.PromotionToRook:
            case MoveFlag.PromotionToRookCapture:
                finalPiece = this.sideToMove | Piece.Rook;
                break;
            case MoveFlag.PromotionToQueen:
            case MoveFlag.PromotionToQueenCapture:
                finalPiece = this.sideToMove | Piece.Queen;
                break;
        }

        this.setBit(finalPiece, target);
        this.zobristKey ^= Zobrist.pieceKeys[finalPiece]![target] || 0n; // add piece to new square

        if(flag === MoveFlag.KingCastle) {
            this.popBit(this.sideToMove | Piece.Rook, target + 1);
            this.setBit(this.sideToMove | Piece.Rook, target - 1);
            this.zobristKey ^= Zobrist.pieceKeys[this.sideToMove | Piece.Rook]![target + 1] || 0n; // removing rook from old square
            this.zobristKey ^= Zobrist.pieceKeys[this.sideToMove | Piece.Rook]![target - 1] || 0n; // adding rook to new square
        } else if (flag === MoveFlag.QueenCastle) {
            this.popBit(this.sideToMove | Piece.Rook, target - 2);
            this.setBit(this.sideToMove | Piece.Rook, target + 1);
            this.zobristKey ^= Zobrist.pieceKeys[this.sideToMove | Piece.Rook]![target - 2] || 0n; // removing rook from old square
            this.zobristKey ^= Zobrist.pieceKeys[this.sideToMove | Piece.Rook]![target + 1] || 0n; // adding rook to new square
        }
        
        if (flag === MoveFlag.DoublePawnPush) {
            const enPassantFile = source % 8;
            this.currentGameState |= ((enPassantFile + 1) << 4);
            this.zobristKey ^= Zobrist.enPassantKeys[enPassantFile] || 0n; // en passant file
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
        
        if (oldCastlingRights !== updatedCastlingRights) {
            this.zobristKey ^= Zobrist.castlingKeys[oldCastlingRights] || 0n; // remove
            this.zobristKey ^= Zobrist.castlingKeys[updatedCastlingRights] || 0n; // add
        }

        this.currentGameState = (this.currentGameState & ~0b1111) | updatedCastlingRights;
        
        this.updateOccupancies();

        this.zobristKey ^= Zobrist.sideKey;
        this.sideToMove ^= Piece.ColorMask;
    }

    unmakeMove(move: Move): void {
        const source = MoveUtils.getSourceSquare(move);
        const target = MoveUtils.getTargetSquare(move);
        const flag = MoveUtils.getMoveFlag(move);

        this.sideToMove ^= Piece.ColorMask;

        const capturedType = BoardUtils.getCapturedPieceType(this);
        const capturedPiece = capturedType !== Piece.None ? (capturedType | (this.sideToMove ^ Piece.ColorMask)) : Piece.None;

        const previousState = this.gameStateHistory.pop()!;
        this.currentGameState = previousState.state;
        this.zobristKey = previousState.zobrist;

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

    public isFiftyMoveRule(): boolean {
        return BoardUtils.getHalfmoveClock(this) >= 100;
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

        this.zobristKey = Zobrist.computeZobristKey(this);// intial zobrist key
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

    export function bitBoardCount(board: bigint): number {
        let count = 0;
        let bb = board;
        while (bb) {
            bb &= bb - 1n;
            count++;
        }
        return count;
    }
}