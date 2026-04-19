import { AvatarImg } from "@/components/game/primitives";
import type { PlayerState } from "@/types";

interface GameOverScreenProps {
  winner: PlayerState | null;
  isHost: boolean;
  onPlayAgain: () => void;
}

export default function GameOverScreen({
  winner,
  isHost,
  onPlayAgain,
}: GameOverScreenProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
        Winner
      </span>
      {winner && <AvatarImg seed={winner.id} name={winner.name} size={72} />}
      <span className="font-mono text-6xl font-semibold">
        {winner?.name ?? "—"}
      </span>
      <span className="text-xs text-muted-foreground">Last one standing.</span>
      <button
        onClick={onPlayAgain}
        disabled={!isHost}
        className="mt-3 h-9 rounded-md bg-primary px-5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none"
      >
        {isHost ? "Play again →" : "Waiting for host…"}
      </button>
    </div>
  );
}
