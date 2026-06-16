import { Board, BoardUtils } from "../board/board";
import { Piece } from "../board/piece";
import { Search } from "../engine/search";
import { MoveUtils } from "../move/move";

const board = new Board();
const search = new Search(board);

export function botvbot() {
    const initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    board.loadPositionFromFen(initialFen);
    const timePerMove = 5000;
    console.time("Bot vs Bot Time");
    while (true) {
        if (BoardUtils.isThreefoldRepetition(board)) {
            console.log("Game over: draw by threefold repetition");
            board.printBoard();
            break;
        }

        if (board.isFiftyMoveRule()) {
            console.log("Game over: draw by fifty-move rule");
            board.printBoard();
            break;
        }

        const searchResult = search.search(timePerMove)!;
        if (!searchResult) {
            console.log("Game over" + (search.immediateMateScore >= 100000 ? ": checkmate" + (board.sideToMove === Piece.White ? " (Black wins)" : " (White wins)") : ": stalemate"));
            board.printBoard()
            break;
        }
        const [bestMove, bestEvaluation] = searchResult;
        if (!bestMove) {
            console.log("Game over" + (search.immediateMateScore >= 100000 ? ": checkmate" + (board.sideToMove === Piece.White ? " (Black wins)" : " (White wins)") : ": stalemate"));
            board.printBoard()
            break;
        }

        console.log(`Best move: ${MoveUtils.moveToString(bestMove)}, Evaluation: ${bestEvaluation}`);
        board.makeMove(bestMove);
    }
    console.timeEnd("Bot vs Bot Time");
}

botvbot();