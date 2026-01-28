export class Attacks {
    public static knightAttacks: bigint[] = new Array(64);
    public static kingAttacks: bigint[] = new Array(64);
    public static whitePawnAttacks: bigint[] = new Array(64);
    public static blackPawnAttacks: bigint[] = new Array(64);
    
    public static readonly FILE_A = 0x0101010101010101n;
    public static readonly FILE_H = 0x8080808080808080n;
    public static readonly RANK_1 = 0xFFn;
    public static readonly RANK_8 = 0xFF00000000000000n;

    static {
        this.initializeAttacks();
    }

    private static initializeAttacks(): void {
        this.initializeKnightAttacks();
        this.initializeKingAttacks();
        this.initializePawnAttacks(); 
        // maybe magicboard if i understand it later
    }

    private static initializeKnightAttacks(): void {
        const knightMoves = [
            { dr: 2, df: 1 }, { dr: 2, df: -1 },
            { dr: -2, df: 1 }, { dr: -2, df: -1 },
            { dr: 1, df: 2 }, { dr: 1, df: -2 },
            { dr: -1, df: 2 }, { dr: -1, df: -2 }
        ];

        for (let square = 0; square < 64; square++) {
            let attacks = 0n;
            const rank = Math.floor(square / 8);
            const file = square % 8;

            for (const move of knightMoves) {
                const newRank = rank + move.dr;
                const newFile = file + move.df;

                if (newRank >= 0 && newRank < 8 && newFile >= 0 && newFile < 8) {
                    const targetSquare = newRank * 8 + newFile;
                    attacks |= (1n << BigInt(targetSquare));
                }
            }

            this.knightAttacks[square] = attacks;
        }
    }

    private static initializeKingAttacks(): void {
        const kingMoves = [
            { dr: 1, df: 0 }, { dr: 1, df: 1 }, { dr: 1, df: -1 },
            { dr: 0, df: 1 }, { dr: 0, df: -1 },
            { dr: -1, df: 0 }, { dr: -1, df: 1 }, { dr: -1, df: -1 }
        ];

        for (let square = 0; square < 64; square++) {
            let attacks = 0n;
            const rank = Math.floor(square / 8);
            const file = square % 8;

            for (const move of kingMoves) {
                const newRank = rank + move.dr;
                const newFile = file + move.df;

                if (newRank >= 0 && newRank < 8 && newFile >= 0 && newFile < 8) {
                    const targetSquare = newRank * 8 + newFile;
                    attacks |= (1n << BigInt(targetSquare));
                }
            }

            this.kingAttacks[square] = attacks;
        }
    }

    private static initializePawnAttacks(): void {
        for (let square = 0; square < 64; square++) {
            const rank = Math.floor(square / 8);
            const file = square % 8;

            // White pawn attacks
            let whiteAttacks = 0n;
            if (rank < 7) {
                if (file > 0) whiteAttacks |= (1n << BigInt(square + 7)); // Up-left
                if (file < 7) whiteAttacks |= (1n << BigInt(square + 9)); // Up-right
            }
            this.whitePawnAttacks[square] = whiteAttacks;

            // Black pawn attacks
            let blackAttacks = 0n;
            if (rank > 0) {
                if (file > 0) blackAttacks |= (1n << BigInt(square - 9)); // Down-left
                if (file < 7) blackAttacks |= (1n << BigInt(square - 7)); // Down-right
            }
            this.blackPawnAttacks[square] = blackAttacks;
        }
    }

    public static getRookAttacks(square: number, occupied: bigint): bigint {
        let attacks = 0n;
        const rank = square >> 3;
        const file = square & 7;

        // top
        for (let r = rank + 1; r < 8; r++) {
            const sq = (r << 3) + file;
            attacks |= (1n << BigInt(sq));
            if ((occupied & (1n << BigInt(sq))) !== 0n) break;
        }

        // bottom
        for (let r = rank - 1; r >= 0; r--) {
            const sq = (r << 3) + file;
            attacks |= (1n << BigInt(sq));
            if ((occupied & (1n << BigInt(sq))) !== 0n) break;
        }

        // right
        for (let f = file + 1; f < 8; f++) {
            const sq = (rank << 3) + f;
            attacks |= (1n << BigInt(sq));
            if ((occupied & (1n << BigInt(sq))) !== 0n) break;
        }

        //left
        for (let f = file - 1; f >= 0; f--) {
            const sq = (rank << 3) + f;
            attacks |= (1n << BigInt(sq));
            if ((occupied & (1n << BigInt(sq))) !== 0n) break;
        }

        return attacks;
    }

    public static getBishopAttacks(square: number, occupied: bigint): bigint {
        let attacks = 0n;
        const rank = square >> 3;
        const file = square & 7;

        //top-right
        for (let r = rank + 1, f = file + 1; r < 8 && f < 8; r++, f++) {
            const sq = (r << 3) + f;
            attacks |= (1n << BigInt(sq));
            if ((occupied & (1n << BigInt(sq))) !== 0n) break;
        }

        //top-left
        for (let r = rank + 1, f = file - 1; r < 8 && f >= 0; r++, f--) {
            const sq = (r << 3) + f;
            attacks |= (1n << BigInt(sq));
            if ((occupied & (1n << BigInt(sq))) !== 0n) break;
        }

        //bottom-right
        for (let r = rank - 1, f = file + 1; r >= 0 && f < 8; r--, f++) {
            const sq = (r << 3) + f;
            attacks |= (1n << BigInt(sq));
            if ((occupied & (1n << BigInt(sq))) !== 0n) break;
        }

        //bottom-left
        for (let r = rank - 1, f = file - 1; r >= 0 && f >= 0; r--, f--) {
            const sq = (r << 3) + f;
            attacks |= (1n << BigInt(sq));
            if ((occupied & (1n << BigInt(sq))) !== 0n) break;
        }

        return attacks;
    }

    public static getQueenAttacks(square: number, occupied: bigint): bigint {
        return this.getRookAttacks(square, occupied) | this.getBishopAttacks(square, occupied);
    }

    public static whitePawnAttacksFromBitboard(pawns: bigint): bigint {
        return ((pawns << 7n) & ~Attacks.FILE_H)| ((pawns << 9n) & ~Attacks.FILE_A);
    }   

    public static blackPawnAttacksFromBitboard(pawns: bigint): bigint {
        return ((pawns >> 7n) & ~Attacks.FILE_A) | ((pawns >> 9n) & ~Attacks.FILE_H);
    }

    public static getLSB(bitboard: bigint): number {
        if (bitboard === 0n) return -1;
        
        let square = 0;
        let bb = bitboard;
        
        while ((bb & 1n) === 0n) {
            bb >>= 1n;
            square++;
        }
        
        return square;
    }

    public static popLSB(bitboard: bigint): bigint {
        return bitboard & (bitboard - 1n);
    }
}