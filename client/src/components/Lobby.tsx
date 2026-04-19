import Chat from "@/components/Chat";
import PlayerList from "@/components/PlayerList";
import RoomInfo from "@/components/RoomInfo";

export default function Lobby() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex gap-4 w-full max-w-5xl h-[min(80vh,640px)]">
        <div className="flex flex-col gap-4 w-72 shrink-0">
          <RoomInfo />
          <PlayerList />
        </div>
        <div className="flex-1 min-w-0">
          <Chat />
        </div>
      </div>
    </div>
  );
}
