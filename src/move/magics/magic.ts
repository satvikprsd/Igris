import { MagicHelper } from "./magicsHelper";
import { PrecomputedMagics } from "./precomputedMagics";

export class Magic {
    static readonly RookMask: bigint[] = new Array(64);
    static readonly BishopMask: bigint[] = new Array(64);
    static readonly RookAttacks: bigint[][] = new Array(64);
    static readonly BishopAttacks: bigint[][] = new Array(64);

    private static initialized = false;

    static initialize(): void {
        if (this.initialized) return;

        for (let square = 0; square < 64; square++) {
            this.RookMask[square] = MagicHelper.createMovementMask(square, true);
            this.BishopMask[square] = MagicHelper.createMovementMask(square, false);
        }

        //attack tables
        for (let square = 0; square < 64; square++) {
            this.RookAttacks[square] = this.createTable(square, true, PrecomputedMagics.RookMagics[square]!, PrecomputedMagics.RookShifts[square]!);

            this.BishopAttacks[square] = this.createTable(square, false, PrecomputedMagics.BishopMagics[square]!, PrecomputedMagics.BishopShifts[square]!);
        }

        this.initialized = true;
    }

    private static readonly MASK_64 = (1n << 64n) - 1n;

    private static createTable(square: number, isRook: boolean, magic: bigint, leftShift: number): bigint[] {
        const numBits = 64 - leftShift;
        const lookupSize = 1 << numBits;
        const table: bigint[] = new Array(lookupSize);

        const movementMask = MagicHelper.createMovementMask(square, isRook);
        const blockerPatterns = MagicHelper.createAllBlockerBitboards(movementMask);

        for (const pattern of blockerPatterns) {
            const index = Number(((pattern * magic) & this.MASK_64) >> BigInt(leftShift));
            const moves = MagicHelper.legalMoveBitboardFromBlockers(square, pattern, isRook);
            table[index] = moves;
        }

        return table;
    }

    static getSliderAttacks(square: number, blockers: bigint, isRook: boolean): bigint {
        return isRook ? this.getRookAttacks(square, blockers) : this.getBishopAttacks(square, blockers);
    }

    static getRookAttacks(square: number, blockers: bigint): bigint {
        const key = Number((((blockers & this.RookMask[square]!) * PrecomputedMagics.RookMagics[square]!) & this.MASK_64) >> BigInt(PrecomputedMagics.RookShifts[square]!));
        return this.RookAttacks[square]![key]!;
    }

    static getBishopAttacks(square: number, blockers: bigint): bigint {
        const key = Number((((blockers & this.BishopMask[square]!) * PrecomputedMagics.BishopMagics[square]!) & this.MASK_64) >> BigInt(PrecomputedMagics.BishopShifts[square]!));
        return this.BishopAttacks[square]![key]!;
    }

    static getQueenAttacks(square: number, blockers: bigint): bigint {
        return this.getRookAttacks(square, blockers) | this.getBishopAttacks(square, blockers);
    }
}
