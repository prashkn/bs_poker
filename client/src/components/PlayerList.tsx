import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PlayerState } from "@/types";
import type { WSMessage } from "@/hooks/useWebSocket";

interface PlayerListProps {
  players: PlayerState[];
  hostId: string;
  playerId: string;
  connected: boolean;
  send: (msg: WSMessage) => void;
}

export default function PlayerList({ players, hostId, playerId, connected, send }: PlayerListProps) {
  const isHost = playerId === hostId;

  return (
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
                {isHost && p.id !== playerId && (
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
      {isHost && (
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
  );
}
