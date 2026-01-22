import { Piece } from "./piece";


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
    public castlingRights: number = 0;
    public enPassantSquare: number = -1;
    public halfmoveClock: number = 0;
    public fullmoveNumber: number = 1; 

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
        for (let piece = Piece.White | Piece.Pawn; piece <= (Piece.White | Piece.King); piece++) {
            this.whitePieces |= this.bitboards[piece]!;
        }
        for (let piece = Piece.Black | Piece.Pawn; piece <= (Piece.Black | Piece.King); piece++) {
            this.blackPieces |= this.bitboards[piece]!;
        }
        this.allPieces = this.whitePieces | this.blackPieces;
    }
    
    clearBoard(): void {
        this.bitboards.fill(0n);
        this.whitePieces = 0n;
        this.blackPieces = 0n;
        this.allPieces = 0n;
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
            this.castlingRights = this.parseCastlingRights(parts[2]);
        }
        if (parts[3]) {
            this.enPassantSquare = this.parseEnPassantSquare(parts[3]);
        }
        if (parts[4]) {
            this.halfmoveClock = parseInt(parts[4]);
        }
        if (parts[5]) {
            this.fullmoveNumber = parseInt(parts[5]);
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

    private parseCastlingRights(fen: string): number {
        let rights = 0;

        if (fen.includes('K')) rights |= Castling.WK;
        if (fen.includes('Q')) rights |= Castling.WQ;
        if (fen.includes('k')) rights |= Castling.BK;
        if (fen.includes('q')) rights |= Castling.BQ;

        return rights;
    }

    private parseEnPassantSquare(fen: string): number {
        if (fen === '-') return -1;
        const file = fen.charCodeAt(0) - 'a'.charCodeAt(0);
        const rank = parseInt(fen[1]!) - 1;
        return rank*8 + file;
    }
}