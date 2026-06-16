import { Board } from "./board/board";
import { Search } from "./engine/search";
import { MoveUtils } from "./move/move";
import { setOpeningBook } from "./utils/openingBookLookup";

if (typeof self !== "undefined" && typeof fetch === "function") {
    fetch("openingBook.json")
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            setOpeningBook(data);
            console.log("Opening book loaded successfully in worker!");
        })
        .catch(err => {
            console.error("Failed to load opening book in worker:", err);
        });
}

self.onmessage = (event: MessageEvent) => {
    const { type, initialFen, moves, timeLimit } = event.data;

    if (type === "search") {
        try {
            const board = new Board();
            board.loadPositionFromFen(initialFen);

            for (const move of moves) {
                board.makeMove(move);
            }

            const search = new Search(board);
            const searchResult = search.search(timeLimit || 1000);

            if (searchResult) {
                const [bestMove, bestEvaluation] = searchResult;
                if (bestMove !== null) {
                    const moveString = MoveUtils.moveToString(bestMove);
                    self.postMessage({
                        type: "searchResult",
                        move: moveString,
                        moveEncoded: bestMove,
                        evaluation: bestEvaluation
                    });
                    return;
                }
            }

            self.postMessage({
                type: "error",
                error: "Bot failed to find a valid move."
            });
        } catch (e: any) {
            self.postMessage({
                type: "error",
                error: e.message || "An error occurred during search."
            });
        }
    }
};
