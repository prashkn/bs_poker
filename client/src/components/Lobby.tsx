import Chat from "@/components/Chat";
import PlayerList from "@/components/PlayerList";
import RoomInfo from "@/components/RoomInfo";

export default function Lobby() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-5xl flex-col gap-4 md:h-[min(80vh,640px)] md:flex-row">
        <div className="flex w-full flex-col gap-4 md:w-72 md:shrink-0">
          <RoomInfo />
          <PlayerList />
        </div>
        <div className="h-[60vh] min-w-0 md:h-auto md:flex-1">
          <Chat />
        </div>
      </div>
    </div>
  );
}
