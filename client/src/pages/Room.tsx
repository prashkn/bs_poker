import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { useGetRoom, useJoinRoom } from "@/api/room";
import JoinRoomModal from "@/components/JoinRoomModal";
import RoomRouter from "@/components/RoomRouter";
import { RoomProvider } from "@/hooks/useRoom";
import { playerIdKey } from "@/lib/storage";
import { toast } from "sonner";

export default function Room() {
  const { id: roomId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [playerId, setPlayerId] = useState(
    () => sessionStorage.getItem(playerIdKey(roomId ?? "")) ?? ""
  );

  const { isLoading, isError, error } = useGetRoom({ room_id: roomId ?? "", player_id: playerId });
  const joinRoom = useJoinRoom();

    // If room doesn't exist, or stored player id is not part of the room, show
  // error and navigate home. Clear the stale id so we don't loop on the next visit.
  useEffect(() => {
    if (!isError) return;
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const message = status === 404 ? "Room not found." : "Unable to join room.";
    if (roomId) sessionStorage.removeItem(playerIdKey(roomId));
    toast.error(message);
    navigate("/", { replace: true });
  }, [isError, error, navigate, roomId]);

  function handleJoin(playerName: string, password: string) {
    joinRoom.mutate(
      { room_id: roomId ?? "", password, player_name: playerName },
      {
        onSuccess: (data) => {
          sessionStorage.setItem(playerIdKey(data.room_id), data.player_id);
          setPlayerId(data.player_id);
        },
        onError: () => {
          toast.error("Failed to join room.");
        },
      }
    );
  }

  const needsJoin = !playerId && !isLoading;
  const ready = !!playerId && !isLoading && !!roomId;

  return (
    <>
      {needsJoin && <JoinRoomModal roomId={roomId ?? ""} onJoin={handleJoin} />}
      <div className={`flex min-h-screen flex-col items-center justify-center p-6 ${needsJoin ? "blur-sm pointer-events-none select-none" : ""}`}>
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : ready ? (
          <RoomProvider roomId={roomId!} playerId={playerId}>
            <RoomRouter />
          </RoomProvider>
        ) : null}
      </div>
    </>
  );
}
