import GameBoard from "./game/GameBoard";
import Lobby from "./Lobby";
import { useGame } from "@/hooks/useRoom";

export default function RoomRouter() {
  const { phase } = useGame();
  switch (phase) {
    case "playing":
    case "game_over":
      return <GameBoard />;
    case "lobby":
      return <Lobby />;
  }
}
