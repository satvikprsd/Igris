export class MagicHelper {
    static createMovementMask(square: number, isRook: boolean): bigint {
        let mask = 0n;
        const rank = Math.floor(square / 8);
        const file = square % 8;

        if (isRook) {
            // North
            for (let r = rank + 1; r <= 6; r++) {
                mask |= 1n << BigInt(r * 8 + file);
            }
            // South
            for (let r = rank - 1; r >= 1; r--) {
                mask |= 1n << BigInt(r * 8 + file);
            }
            // East
            for (let f = file + 1; f <= 6; f++) {
                mask |= 1n << BigInt(rank * 8 + f);
            }
            // West
            for (let f = file - 1; f >= 1; f--) {
                mask |= 1n << BigInt(rank * 8 + f);
            }
        } else {
            const directions = [
                [1, 1],   // NE
                [1, -1],  // NW
                [-1, 1],  // SE
                [-1, -1]  // SW
            ];

            for (const [dr, df] of directions) {
                let r = rank + dr!;
                let f = file + df!;
                while (r >= 1 && r <= 6 && f >= 1 && f <= 6) {
                    mask |= 1n << BigInt(r * 8 + f);
                    r += dr!;
                    f += df!;
                }
            }
        }

        return mask;
    }

    static createAllBlockerBitboards(mask: bigint): bigint[] {
        const setBits: number[] = [];
        let tempMask = mask;

        for (let i = 0; i < 64; i++) {
            if ((tempMask & (1n << BigInt(i))) !== 0n) {
                setBits.push(i);
            }
        }

        const numPatterns = 1 << setBits.length;
        const blockerPatterns: bigint[] = new Array(numPatterns);

        //2^n combinations
        for (let patternIndex = 0; patternIndex < numPatterns; patternIndex++) {
            let pattern = 0n;
            for (let bitIndex = 0; bitIndex < setBits.length; bitIndex++) {
                if ((patternIndex & (1 << bitIndex)) !== 0) {
                    pattern |= 1n << BigInt(setBits[bitIndex]!);
                }
            }
            blockerPatterns[patternIndex] = pattern;
        }

        return blockerPatterns;
    }

    static legalMoveBitboardFromBlockers(square: number, blockers: bigint, isRook: boolean): bigint {
        let moves = 0n;
        const rank = Math.floor(square / 8);
        const file = square % 8;

        if (isRook) {
            // North
            for (let r = rank + 1; r < 8; r++) {
                const sq = r * 8 + file;
                moves |= 1n << BigInt(sq);
                if ((blockers & (1n << BigInt(sq))) !== 0n) break;
            }
            // South
            for (let r = rank - 1; r >= 0; r--) {
                const sq = r * 8 + file;
                moves |= 1n << BigInt(sq);
                if ((blockers & (1n << BigInt(sq))) !== 0n) break;
            }
            // East
            for (let f = file + 1; f < 8; f++) {
                const sq = rank * 8 + f;
                moves |= 1n << BigInt(sq);
                if ((blockers & (1n << BigInt(sq))) !== 0n) break;
            }
            // West
            for (let f = file - 1; f >= 0; f--) {
                const sq = rank * 8 + f;
                moves |= 1n << BigInt(sq);
                if ((blockers & (1n << BigInt(sq))) !== 0n) break;
            }
        } else {
            // Bishop diagonals
            const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
            
            for (const [dr, df] of directions) {
                let r = rank + dr!;
                let f = file + df!;
                while (r >= 0 && r < 8 && f >= 0 && f < 8) {
                    const sq = r * 8 + f;
                    moves |= 1n << BigInt(sq);
                    if ((blockers & (1n << BigInt(sq))) !== 0n) break;
                    r += dr!;
                    f += df!;
                }
            }
        }

        return moves;
    }
}