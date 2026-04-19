import { useState } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import type { RoomSettings } from "@/types";

interface RoomChromeProps {
  roomId: string;
  password: string;
  settings: RoomSettings | null;
  alivePlayerCount: number;
  round: number;
  totalCards: number;
}

export default function RoomChrome({
  roomId,
  password,
  settings,
  alivePlayerCount,
  round,
  totalCards,
}: RoomChromeProps) {
  const [revealed, setRevealed] = useState(false);
  const maxCards = settings?.max_cards_before_elimination ?? "—";
  const turnTime = settings ? Math.round(settings.time_per_turn / 1e9) : "—";

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-3">
      <div className="flex items-baseline gap-4">
        <span className="text-sm font-semibold tracking-tight">BS Poker</span>
        <div className="h-3 w-px bg-border" />
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Room
          </span>
          <span className="font-mono text-xs">{roomId}</span>
          <button
            onClick={() => copy(roomId, "Room code")}
            className="text-muted-foreground hover:text-foreground"
            title="Copy room code"
            aria-label="Copy room code"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
        {password && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Pass
            </span>
            <span className="font-mono text-xs">
              {revealed ? password : "••••••"}
            </span>
            <button
              onClick={() => setRevealed((v) => !v)}
              className="text-muted-foreground hover:text-foreground"
              title={revealed ? "Hide password" : "Show password"}
              aria-label={revealed ? "Hide password" : "Show password"}
            >
              {revealed ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] uppercase tracking-wider">Round</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {String(round).padStart(2, "0")}
          </span>
        </div>
        <div className="h-3 w-px bg-border" />
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] uppercase tracking-wider">Cards in play</span>
          <span className="tabular-nums text-foreground">{totalCards}</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <span>
          Max cards <span className="text-foreground">{maxCards}</span>
        </span>
        <span>
          Turn time <span className="text-foreground">{turnTime}s</span>
        </span>
        <span>{alivePlayerCount} players</span>
      </div>
    </div>
  );
}
