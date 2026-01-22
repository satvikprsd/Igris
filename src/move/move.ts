export type Move = number;
// 0000 000000 000000
// flag target source

export enum MoveFlag {
    Quiet = 0,
    DoublePawnPush = 1,
    KingCastle = 2,
    QueenCastle = 3,
    Capture = 4,
    EnPassant = 5,
    PromotionToKnight = 8,
    PromotionToBishop = 9,
    PromotionToRook = 10,
    PromotionToQueen = 11,
    PromotionToKnightCapture = 12,
    PromotionToBishopCapture = 13,
    PromotionToRookCapture = 14,
    PromotionToQueenCapture = 15,
}

export namespace MoveUtils { 
    const FLAG_MASK = 0b1111_0000_0000_0000;
    const TARGET_MASK = 0b0000_111111_000000;
    const SOURCE_MASK = 0b0000_000000_111111;

    export function encode(source: number, target: number, flag: number = 0) : Move {
        return ((flag << 12) | (target << 6) | source) as Move;
    }

    export function getSourceSquare(move: Move) : number {
        return (move & SOURCE_MASK);
    }

    export function getTargetSquare(move: Move) : number {
        return (move & TARGET_MASK) >> 6;
    }

    export function getMoveFlag(move: Move) : number {
        return (move & FLAG_MASK) >> 12;
    }

    export function moveToString(move: Move) : string {
        const source = getSourceSquare(move);
        const target = getTargetSquare(move);
        return squareToString(source) + squareToString(target);
    }
}

export function squareToString(square: number): string {
    const file = square % 8;
    const rank = Math.floor(square / 8);
    return String.fromCharCode('a'.charCodeAt(0) + file) + (rank+1).toString();
}

export function stringToSquare(squareStr: string): number {
    //if (squareStr.length !== 2) throw new Error("Invalid square string");
    const file = squareStr.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = parseInt(squareStr[1]!) - 1;
    return rank * 8 + file;
}


