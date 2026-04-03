import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PlayerInfo {
  id: string;
  name: string;
}

export default function Room() {
  const { id: roomId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const playerId = searchParams.get("player_id") ?? "";

  const { messages, connected } = useWebSocket(roomId ?? "", playerId);

  // Build current player list from messages
  const players = useMemo(() => {
    const playerMap = new Map<string, PlayerInfo>();

    for (const msg of messages) {
      if (msg.type === "room_state") {
        playerMap.clear();
        const list = msg.players as PlayerInfo[];
        for (const p of list) {
          playerMap.set(p.id, p);
        }
      } else if (msg.type === "player_joined") {
        playerMap.set(msg.player_id as string, {
          id: msg.player_id as string,
          name: msg.name as string,
        });
      } else if (msg.type === "player_left") {
        playerMap.delete(msg.player_id as string);
      }
    }

    return Array.from(playerMap.values());
  }, [messages]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="mb-2 text-4xl font-bold text-foreground">BS Poker</h1>
      <p className="mb-6 text-muted-foreground">
        Room: <span className="font-mono font-semibold text-foreground">{roomId}</span>
      </p>

      <div className="mb-4 text-sm">
        {connected ? (
          <span className="text-green-500">Connected</span>
        ) : (
          <span className="text-red-500">Disconnected</span>
        )}
      </div>

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
                  {p.id === playerId && (
                    <span className="text-xs text-muted-foreground">(you)</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
