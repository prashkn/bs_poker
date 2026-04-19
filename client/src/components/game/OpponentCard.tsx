import {
  AvatarImg,
  CardCountVisual,
  Pill,
  TurnTimer,
} from "@/components/game/primitives";
import type { PlayerState } from "@/types";

interface OpponentCardProps {
  player: PlayerState;
  isCurrentTurn: boolean;
  turnSecondsLeft: number;
  turnTotalSeconds: number;
  lastClaimText?: string;
}

export default function OpponentCard({
  player,
  isCurrentTurn,
  turnSecondsLeft,
  turnTotalSeconds,
  lastClaimText,
}: OpponentCardProps) {
  const dead = !player.isAlive;
  const ringCls = isCurrentTurn
    ? "ring-1 ring-foreground/90 turn-ring"
    : "border-border";

  return (
    <div
      className={`relative flex flex-col gap-1.5 p-2.5 rounded-md border bg-card ${ringCls} ${
        dead ? "opacity-40" : ""
      } transition-all`}
    >
      <div className="relative flex items-center gap-2">
        <AvatarImg seed={player.id} name={player.name} size={24} />
        <div className="min-w-0 flex-1">
          <div
            className={`truncate text-xs font-medium ${dead ? "line-through" : ""}`}
          >
            {player.name}
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            {dead ? (
              <Pill tone="muted">out</Pill>
            ) : (
              <CardCountVisual count={player.cardCount} size="xs" mode="backs" />
            )}
            {!player.connected && (
              <span className="text-[9px] font-mono text-muted-foreground">off</span>
            )}
          </div>
        </div>
      </div>

      {!dead && lastClaimText && (
        <div className="relative truncate text-[10px] text-muted-foreground">
          <span className="font-mono">↳</span> {lastClaimText}
        </div>
      )}

      {isCurrentTurn && !dead && (
        <div className="relative">
          <TurnTimer
            secondsLeft={turnSecondsLeft}
            total={turnTotalSeconds}
            compact
          />
        </div>
      )}
    </div>
  );
}
