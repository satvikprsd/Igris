export type Move = number;
// 0000 000000 000000
// flag target source

export namespace MoveUtils { 
    const FLAG_MASK = 0b1111_0000_0000_0000;
    const TARGET_MASK = 0b0000_111111_000000;
    const SOURCE_MASK = 0b0000_000000_111111;

    export function createMove(source: number, target: number, flag: number = 0) : Move {
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
}

export function squareToString(square: number): string {
    const file = square % 8;
    const rank = Math.floor(square / 8);
    return String.fromCharCode('a'.charCodeAt(0) + file) + (rank+1).toString();
}