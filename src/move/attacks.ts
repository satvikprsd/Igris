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

    // rays pending hai (study)
    
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