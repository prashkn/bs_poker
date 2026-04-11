import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { useGetRoom, useJoinRoom } from "@/api/room";
import JoinRoomModal from "@/components/JoinRoomModal";
import { toast } from "sonner";

export default function Room() {
  const { id: roomId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [playerId, setPlayerId] = useState(
    () => sessionStorage.getItem(`player_id:${roomId}`) ?? ""
  );

  const { isLoading, isError, error } = useGetRoom({ room_id: roomId ?? "", player_id: playerId });
  const joinRoom = useJoinRoom();

    // If room doesn't exist, or given player id is not apart of the room, show error and navigate home.
  useEffect(() => {
    if (!isError) return;
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const message = status === 404 ? "Room not found." : "Unable to join room.";
    toast.error(message, { position: "top-center" });
    navigate("/", { replace: true });
  }, [isError, error, navigate]);

  function handleJoin(playerName: string, password: string) {
    joinRoom.mutate(
      { room_id: roomId ?? "", password, player_name: playerName },
      {
        onSuccess: (data) => {
          sessionStorage.setItem(`player_id:${data.room_id}`, data.player_id);
          setPlayerId(data.player_id);
        },
        onError: () => {
          toast.error("Failed to join room.", { position: "top-center" });
        },
      }
    );
  }

  const needsJoin = !playerId && !isLoading;

  return (
    <>
      {needsJoin && <JoinRoomModal roomId={roomId ?? ""} onJoin={handleJoin} />}
      <div className={`flex min-h-screen flex-col items-center justify-center p-6 ${needsJoin ? "blur-sm pointer-events-none select-none" : ""}`}>
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <h1>Hello World</h1>}
      </div>
    </>
  );
}
