import { Board } from "../board/board";
import { Search } from "../engine/search";
import { MoveUtils } from "../move/move";

const board = new Board();
const search = new Search(board);

export function botvbot() {
    const initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    board.loadPositionFromFen(initialFen);
    const timePerMove = 1000;
    console.time("Bot vs Bot Time");
    while (true) {
        const searchResult = search.search(timePerMove)!;
        if (!searchResult) {
            console.log("Game over");
            board.printBoard()
            break;
        }
        const [bestMove, bestEvaluation] = searchResult;
        if (!bestMove) {
            console.log("Game over");
            board.printBoard()
            break;
        }

        console.log(`Best move: ${MoveUtils.moveToString(bestMove)}, Evaluation: ${bestEvaluation}`);
        board.makeMove(bestMove);
    }
    console.timeEnd("Bot vs Bot Time");
}

botvbot();