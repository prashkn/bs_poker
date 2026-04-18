import GameBoard from "./GameBoard";
import Lobby from "./Lobby";
import { useGame } from "@/hooks/useRoom";

// Picks the top-level screen for the current room phase. When the game ends
// the server resets phase back to "lobby" for the next round, so game_over
// falls through to the lobby view (any end-of-game UI can read winnerId
// from useGame() and overlay itself on the lobby).
export default function RoomRouter() {
  const { phase } = useGame();
  switch (phase) {
    case "playing":
      return <GameBoard />;
    case "game_over":
    case "lobby":
      return <Lobby />;
  }
}
