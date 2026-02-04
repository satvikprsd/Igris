import random

SEED = 29426028
OUTPUT_FILE = "zobristKeys.ts"

NUM_PIECES = 15
NUM_SQUARES = 64
NUM_CASTLING = 16
NUM_EP_FILES = 8

random.seed(SEED)

def rand64():
    return random.getrandbits(64)

def fmt(n):
    return f"0x{n:016x}n"

with open(OUTPUT_FILE, "w") as f:
    f.write("export const ZOBRIST_PIECE: bigint[][] = [\n")

    for p in range(NUM_PIECES):
        f.write("  [\n")
        for sq in range(NUM_SQUARES):
            f.write(f"    {fmt(rand64())},\n")
        f.write("  ],\n")

    f.write("];\n\n")

    f.write("export const ZOBRIST_CASTLING: bigint[] = [\n")
    for _ in range(NUM_CASTLING):
        f.write(f"  {fmt(rand64())},\n")
    f.write("];\n\n")

    f.write("export const ZOBRIST_ENPASSANT: bigint[] = [\n")
    for _ in range(NUM_EP_FILES):
        f.write(f"  {fmt(rand64())},\n")
    f.write("];\n\n")

    f.write("export const ZOBRIST_SIDE: bigint = ")
    f.write(f"{fmt(rand64())};\n")

print(f"Generated {OUTPUT_FILE}")
