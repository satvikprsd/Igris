import { Piece } from "./piece";

export class Board {
    public bitboards: BigInt[];
    public whitePieces: bigint = 0n;
    public blackPieces: bigint = 0n;
    public allPieces: bigint = 0n;
    public sideToMove: Piece.White | Piece.Black = Piece.White;
    public castlingRights: number = 0;
    public enPassantSquare: number = -1;
    public halfmoveClock: number = 0;
    public fullmoveNumber: number = 1;


}   