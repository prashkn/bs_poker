import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CopyIcon } from "lucide-react";
import { useGetRoom } from "@/api/room";
import { RoomProvider } from "@/context/RoomContext";
import { useRoom } from "@/hooks/useRoom";
import { useGame } from "@/hooks/useRoom";
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
      <RoomProvider roomId={roomId ?? ""} playerId={playerId}>
        <RoomContent needsJoin={needsJoin} roomId={roomId ?? ""} />
      </RoomProvider>
    </div>
  );
}

function RoomContent({ needsJoin, roomId }: { needsJoin: boolean; roomId: string }) {
  const { connected } = useRoom();
  const { phase } = useGame();

  return (
    <div className={needsJoin ? "blur-md pointer-events-none select-none" : ""}>
      <h1 className="mb-2 text-4xl font-bold text-foreground">BS Poker</h1>
      <p className="mb-6 text-muted-foreground">
        Room: <span className="font-mono font-semibold text-foreground">{roomId}</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-1 h-6 w-6"
          onClick={() => {
            navigator.clipboard.writeText(roomId);
            toast.success("Room Code copied", { position: "top-center" });
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
        <PlayerList />
        {phase === "playing" ? (
          <GameBoard />
        ) : (
          <>
            <WebSocketLog />
            <Chat />
          </>
        )}
      </div>
    </div>
  );
}
