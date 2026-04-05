import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CopyIcon } from "lucide-react"
import { useWebSocket } from "@/hooks/useWebSocket";
import { useGameState } from "@/hooks/useGameState";
import { useGetRoom } from "@/api/room";
import JoinRoomModal from "@/components/JoinRoomModal";
import PlayerList from "@/components/PlayerList";
import GameBoard from "@/components/GameBoard";
import WebSocketLog from "@/components/WebSocketLog";
import Chat from "@/components/Chat";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Room() {
  const { id: roomId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [playerId, setPlayerId] = useState(() => sessionStorage.getItem(`player_id:${roomId}`) ?? "");
  const needsJoin = !playerId;

  const { isLoading, isError } = useGetRoom(roomId ?? "");

  useEffect(() => {
    if (isError) {
      toast.error("Room not found.", { position: "top-center" });
      navigate("/", { replace: true });
    }
  }, [isError, navigate]);

  const { messages, log, connected, send } = useWebSocket(roomId ?? "", playerId);
  const gameState = useGameState(messages, playerId);
  const { players, hostId, phase, currentTurnPlayerId, isMyTurn, myHand, round } = gameState;
  const playerList = Array.from(players.values());

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading room...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      {needsJoin && (
        <JoinRoomModal
          roomId={roomId ?? ""}
          onJoined={(id) => setPlayerId(id)}
        />
      )}
      <div className={needsJoin ? "blur-md pointer-events-none select-none" : ""}>
      <h1 className="mb-2 text-4xl font-bold text-foreground">BS Poker</h1>
      <p className="mb-6 text-muted-foreground">
        Room: <span className="font-mono font-semibold text-foreground">{roomId}</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-1 h-6 w-6"
          onClick={() => {
            navigator.clipboard.writeText(roomId ?? "");
            toast.success("Room Code copied", { position: 'top-center' });
          }}
        >
          <CopyIcon className="h-3.5 w-3.5" />
        </Button>
      </p>

      <div className="mb-4 text-sm">
        {connected ? (
          <span className="text-green-500">Connected</span>
        ) : (
          <span className="text-red-500">Disconnected</span>
        )}
      </div>

      <div className="flex gap-4">
        <PlayerList
          players={playerList}
          hostId={hostId}
          playerId={playerId}
          connected={connected}
          send={send}
        />
        {phase === "playing" ? (
          <GameBoard
            currentTurnPlayerId={currentTurnPlayerId}
            players={players}
            isMyTurn={isMyTurn}
            myHand={myHand}
            round={round}
            send={send}
          />
        ) : (
          <>
            <WebSocketLog log={log} />
            <Chat messages={messages} connected={connected} send={send} />
          </>
        )}
      </div>
      </div>
    </div>
  );
}
