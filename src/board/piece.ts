export const enum Piece {
    None = 0,
    King = 1,
    Pawn = 2,
    Knight = 3,
    Bishop = 4,
    Rook = 5,
    Queen = 6,

    White = 0,
    Black = 8,

    TypeMask = 0b00111,
    ColorMask = 0b01000,
}

export namespace PieceUtils {
    export function getType(piece: Piece): Piece {
        return piece & Piece.TypeMask;
    }
    
    export function getColor(piece: Piece): Piece {
        return piece & Piece.ColorMask;
    }

    export function isWhite(piece: Piece): boolean {
        return (piece & Piece.ColorMask) === Piece.White;
    }
    
    export function isBlack(piece: Piece): boolean {
        return (piece & Piece.ColorMask) === Piece.Black;
    }

    export function swapColor(piece: Piece): Piece {
        return piece ^ Piece.ColorMask;
    }

    export function makePiece(type: Piece, color: (Piece.White | Piece.Black)): Piece {
        return (type & Piece.TypeMask) | (color & Piece.ColorMask);
    }
}