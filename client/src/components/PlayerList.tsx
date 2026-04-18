import { Crown, XIcon } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usePlayers } from "@/hooks/useRoom";
import { avatarUrl } from "@/lib/avatar";

export default function PlayerList() {
  const { players, hostId, playerId, connected, send } = usePlayers();
  const isHost = playerId === hostId;

  return (
    <Card className="w-full">
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
                <Avatar className="h-6 w-6">
                  <AvatarImage src={avatarUrl(p.id)} alt={p.name} />
                  <AvatarFallback>{p.name[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className={p.connected ? "" : "opacity-50"}>{p.name}</span>
                {p.id === hostId && (
                  <Crown className="h-3.5 w-3.5 text-yellow-400" aria-label="Host" />
                )}
                {p.id === playerId && (
                  <span className="text-xs text-muted-foreground">(you)</span>
                )}
                {!p.connected && (
                  <span className="text-xs text-muted-foreground">(offline)</span>
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
