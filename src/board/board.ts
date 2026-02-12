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
    public historyIndex: number = 0;
    public zobristKey: bigint = 0n;
    public mailbox: Piece[] = new Array(64).fill(Piece.None);

    constructor() {
        this.bitboards = new Array<bigint>(15).fill(0n);
        for (let i = 0; i < 1024; i++) {
            this.gameStateHistory[i] = {
                zobrist: 0n,
                sideToMove: Piece.White,
                state: 0
            };
        };
    }

    setBit(piece: Piece, square: number): void {
        const mask = 1n << BigInt(square);
        this.bitboards[piece]! |= mask;
        this.mailbox[square] = piece;
        
        if (piece & Piece.ColorMask) { // Black
            this.blackPieces |= mask;
        } else { // White
            this.whitePieces |= mask;
        }
        this.allPieces |= mask;
    }

    popBit(piece: Piece, square: number): void {
        const mask = ~(1n << BigInt(square));
        this.bitboards[piece]! &= mask;
        this.mailbox[square] = Piece.None;
        
        if (piece & Piece.ColorMask) { // Black
            this.blackPieces &= mask;
        } else { // White
            this.whitePieces &= mask;
        }
        this.allPieces &= mask;
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
        this.mailbox.fill(Piece.None);
        this.historyIndex = 0;
    }

    getPieceOnSquare(square: number): Piece {
        return this.mailbox[square]!;
    }

    makeMove(move: Move): void {
        const source = MoveUtils.getSourceSquare(move);
        const target = MoveUtils.getTargetSquare(move);
        const flag = MoveUtils.getMoveFlag(move);
        const movingPiece = this.mailbox[source]!;
        const oldEnPassantFile = (this.currentGameState >> 4) & 0b1111;
        const oldCastlingRights = this.currentGameState & 0b1111;

        // Remove old zobrist state
        this.zobristKey ^= Zobrist.castlingKeys[oldCastlingRights]!;
        if (oldEnPassantFile > 0) {
            this.zobristKey ^= Zobrist.enPassantKeys[oldEnPassantFile - 1]!;
        }

        // console.log(this.currentGameState);
        // this.gameStateHistory.push({
        //     zobrist: this.zobristKey,
        //     sideToMove: this.sideToMove,
        //     state: this.currentGameState
        // });

        const stateEntry = this.gameStateHistory[this.historyIndex]!;
        stateEntry.zobrist = this.zobristKey;
        stateEntry.sideToMove = this.sideToMove;
        stateEntry.state = this.currentGameState;
        this.historyIndex++;
        
        this.currentGameState &= ~(0b111111 << 8);
        this.currentGameState &= ~BoardUtils.EP_MASK;

        // Update halfmove clock
        const pieceType = movingPiece & Piece.TypeMask;
        const isResetMove = pieceType === Piece.Pawn || flag === MoveFlag.Capture || flag >= MoveFlag.PromotionToKnightCapture;
        const halfmoveClock = isResetMove ? 0 : ((this.currentGameState >> 14) & 0x3FFFF) + 1;
        this.currentGameState = (this.currentGameState & ~(0x3FFFF << 14)) | (halfmoveClock << 14);

        if (flag === MoveFlag.Capture || flag >= MoveFlag.PromotionToKnightCapture) {
            const capturedPiece = this.mailbox[target]!;
            this.currentGameState |= ((capturedPiece & Piece.TypeMask) << 8);
            this.zobristKey ^= Zobrist.pieceKeys[capturedPiece]![target]!;
            this.popBit(capturedPiece, target);
        }

        if (flag === MoveFlag.EnPassant) {
            const epCaptureSquare = (this.sideToMove === Piece.White) ? target - 8 : target + 8;
            const capturedPawn = this.mailbox[epCaptureSquare]!;
            this.currentGameState |= (Piece.Pawn << 8);
            this.zobristKey ^= Zobrist.pieceKeys[capturedPawn]![epCaptureSquare]!;
            this.popBit(capturedPawn, epCaptureSquare);
        }
        

        this.zobristKey ^= Zobrist.pieceKeys[movingPiece]![source]!;
        this.popBit(movingPiece, source);

        let finalPiece = movingPiece;
        if (flag >= MoveFlag.PromotionToKnight) {
            const promotionPieces = [Piece.Knight, Piece.Bishop, Piece.Rook, Piece.Queen];
            const promotionIndex = (flag - MoveFlag.PromotionToKnight) & 0b11;
            finalPiece = this.sideToMove | promotionPieces[promotionIndex]!;
        }

        this.setBit(finalPiece, target);
        this.zobristKey ^= Zobrist.pieceKeys[finalPiece]![target]!;

        if(flag === MoveFlag.KingCastle) {
            const rookSource = target + 1;
            const rookTarget = target - 1;
            const rookPiece = this.sideToMove | Piece.Rook;
            this.zobristKey ^= Zobrist.pieceKeys[rookPiece]![rookSource]!;
            this.popBit(rookPiece, rookSource);
            this.zobristKey ^= Zobrist.pieceKeys[rookPiece]![rookTarget]!;
            this.setBit(rookPiece, rookTarget);
        } else if (flag === MoveFlag.QueenCastle) {
            const rookSource = target - 2;
            const rookTarget = target + 1;
            const rookPiece = this.sideToMove | Piece.Rook;
            this.zobristKey ^= Zobrist.pieceKeys[rookPiece]![rookSource]!;
            this.popBit(rookPiece, rookSource);
            this.zobristKey ^= Zobrist.pieceKeys[rookPiece]![rookTarget]!;
            this.setBit(rookPiece, rookTarget);
        }
        
        if (flag === MoveFlag.DoublePawnPush) {
            const enPassantFile = source & 7;
            this.currentGameState |= ((enPassantFile + 1) << 4);
            this.zobristKey ^= Zobrist.enPassantKeys[enPassantFile]!;
        }
        
        let updatedCastlingRights = oldCastlingRights;

        if (pieceType === Piece.King) {
            updatedCastlingRights &= (this.sideToMove === Piece.White) ? ~(Castling.WK | Castling.WQ) : ~(Castling.BK | Castling.BQ);
        } else if (pieceType === Piece.Rook) {
            if (this.sideToMove === Piece.White) {
                if (source === 0) updatedCastlingRights &= ~Castling.WQ;
                else if (source === 7) updatedCastlingRights &= ~Castling.WK;
            } else {
                if (source === 56) updatedCastlingRights &= ~Castling.BQ;
                else if (source === 63) updatedCastlingRights &= ~Castling.BK;
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
            this.zobristKey ^= Zobrist.castlingKeys[updatedCastlingRights]!;
        } else {
            this.zobristKey ^= Zobrist.castlingKeys[oldCastlingRights]!;
        }

        this.currentGameState = (this.currentGameState & ~0b1111) | updatedCastlingRights;

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

        this.historyIndex--;
        const previousState = this.gameStateHistory[this.historyIndex]!;
        this.currentGameState = previousState.state;
        this.zobristKey = previousState.zobrist;

        if (flag === MoveFlag.KingCastle) {
            const rook = this.sideToMove | Piece.Rook;
            this.popBit(rook, target - 1);
            this.setBit(rook, target + 1);
        }
        else if (flag === MoveFlag.QueenCastle) {
            const rook = this.sideToMove | Piece.Rook;
            this.popBit(rook, target + 1);
            this.setBit(rook, target - 2);
        }

        const pieceAtTarget = this.mailbox[target]!;
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