import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CopyIcon, XIcon } from "lucide-react"
import { useWebSocket } from "@/hooks/useWebSocket";
import { useGetRoom } from "@/api/room";
import JoinRoomModal from "@/components/JoinRoomModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

interface PlayerInfo {
  id: string;
  name: string;
}

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
  const [chatInput, setChatInput] = useState("");
  interface ChatEntry { name: string; text: string; isMe: boolean }
  const [localChat, setLocalChat] = useState<ChatEntry[]>([]);

  function handleSendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    send({ event: "chat", payload: { text: chatInput.trim() } });
    setLocalChat((prev) => [...prev, { name: "you", text: chatInput.trim(), isMe: true }]);
    setChatInput("");
  }

  // Build current player list and track host
  const { players, hostId } = useMemo(() => {
    const playerMap = new Map<string, PlayerInfo>();
    let hostId = "";

    for (const msg of messages) {
      const p = msg.payload;
      if (msg.event === "room_state") {
        playerMap.clear();
        hostId = p.host_id as string;
        const list = p.players as PlayerInfo[];
        for (const player of list) {
          playerMap.set(player.id, player);
        }
      } else if (msg.event === "player_joined") {
        playerMap.set(p.player_id as string, {
          id: p.player_id as string,
          name: p.name as string,
        });
      } else if (msg.event === "player_left") {
        playerMap.delete(p.player_id as string);
      } else if (msg.event === "host_changed") {
        hostId = p.player_id as string;
      }
    }

    return { players: Array.from(playerMap.values()), hostId };
  }, [messages]);

  // Append incoming chat messages to localChat
  const lastProcessed = useRef(0);
  useEffect(() => {
    const newMessages = messages.slice(lastProcessed.current);
    lastProcessed.current = messages.length;
    for (const msg of newMessages) {
      if (msg.event === "chat_received") {
        setLocalChat((prev) => [...prev, {
          name: msg.payload.name as string,
          text: msg.payload.text as string,
          isMe: false,
        }]);
      }
    }
  }, [messages]);

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
        <Card className="w-72">
          <CardHeader>
            <CardTitle>Players ({players.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {players.length === 0 ? (
              <p className="text-sm text-muted-foreground">Waiting for players...</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {players.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 text-sm text-foreground"
                  >
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    {p.name}
                    {p.id === hostId && <span title="Host">👑</span>}
                    {p.id === playerId && (
                      <span className="text-xs text-muted-foreground">(you)</span>
                    )}
                    {playerId === hostId && p.id !== playerId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto h-5 w-5 text-muted-foreground hover:text-destructive"
                        onClick={() => send({ event: "kick_player", payload: { player_id: p.id } })}
                      >
                        <XIcon className="h-3 w-3" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          {playerId === hostId && (
            <CardFooter>
              <Button
                className="w-full"
                disabled={!connected || players.length < 2}
                onClick={() => send({ event: "start_game", payload: {} })}
              >
                Start Game
              </Button>
            </CardFooter>
          )}
        </Card>

        <Card className="w-120">
          <CardHeader>
            <CardTitle>WebSocket Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1 max-h-96 overflow-y-auto font-mono text-xs">
              {log.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet...</p>
              ) : (
                log.map((entry, i) => (
                  <div
                    key={i}
                    className={
                      entry.direction === "incoming"
                        ? "text-red-400"
                        : "text-green-400"
                    }
                  >
                    <span className="text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleTimeString()}{" "}
                    </span>
                    <span>
                      {entry.direction === "incoming" ? "◀ IN " : "▶ OUT "}
                    </span>
                    {JSON.stringify(entry.message)}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="w-140 flex flex-col">
          <CardHeader>
            <CardTitle>Chat</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
              {localChat.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet...</p>
              ) : (
                localChat.map((msg, i) => (
                  <div
                    key={i}
                    className={`text-sm ${msg.isMe ? "text-right" : "text-left"}`}
                  >
                    <span className="font-semibold text-foreground">{msg.name}</span>
                    <span className="text-muted-foreground"> {msg.text}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
          <CardFooter>
            <form onSubmit={handleSendChat} className="flex w-full gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                disabled={!connected}
              />
              <Button type="submit" disabled={!connected || !chatInput.trim()}>
                Send
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>
      </div>
    </div>
  );
}
