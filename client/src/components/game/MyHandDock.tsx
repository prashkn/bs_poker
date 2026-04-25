import PlayingCard from "@/components/PlayingCard";
import ClaimPopover from "@/components/ClaimPopover";
import {
  AvatarImg,
  Pill,
  TurnTimer,
  HAND_NAMES,
} from "@/components/game/primitives";
import type { Card, Claim, MadeHand } from "@/types";

interface MyHandDockProps {
  playerId: string;
  playerName: string;
  hand: Card[];
  isMyTurn: boolean;
  canCallBS: boolean;
  onClaim: (madeHand: MadeHand) => void;
  onCallBS: () => void;
  currentClaim: Claim | null;
  turnSecondsLeft: number;
  turnTotalSeconds: number;
}

export default function MyHandDock({
  playerId,
  playerName,
  hand,
  isMyTurn,
  canCallBS,
  onClaim,
  onCallBS,
  currentClaim,
  turnSecondsLeft,
  turnTotalSeconds,
}: MyHandDockProps) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <AvatarImg seed={playerId} name={playerName} size={36} />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold leading-none">
                {playerName}
              </span>
              <Pill tone="muted">You</Pill>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
              Your hand · {hand.length} {hand.length === 1 ? "card" : "cards"}
            </span>
          </div>
        </div>
        <div className="flex items-end gap-1.5">
          {hand.length === 0 ? (
            <div className="flex h-28 items-center px-3 text-xs text-muted-foreground">
              No cards yet
            </div>
          ) : (
            hand.map((c, i) => (
              <div
                key={i}
                style={{
                  transform: `translateY(${Math.abs(i - (hand.length - 1) / 2) * 2}px) rotate(${
                    (i - (hand.length - 1) / 2) * 3
                  }deg)`,
                }}
              >
                <PlayingCard card={c} size="lg" />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        {isMyTurn ? (
          <>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-foreground">
                Your turn
              </span>
              <TurnTimer
                secondsLeft={turnSecondsLeft}
                total={turnTotalSeconds}
                compact
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={onCallBS}
                disabled={!canCallBS}
                className="h-11 rounded-md border border-red-500/40 bg-red-500/10 px-5 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-30 disabled:pointer-events-none"
              >
                Call BS
              </button>
              <ClaimPopover
                onClaim={onClaim}
                disabled={false}
                currentClaim={currentClaim}
                triggerClassName="h-11 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                triggerLabel="Claim →"
              />
            </div>
            <span className="text-[11px] text-muted-foreground">
              Claim must beat{" "}
              {currentClaim
                ? (HAND_NAMES[currentClaim.made_hand.hand_type] ?? "—")
                : "opening"}
            </span>
          </>
        ) : (
          <>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Waiting
            </span>
            <div className="flex gap-2">
              <button
                disabled
                className="h-11 rounded-md border border-border bg-transparent px-5 text-sm font-medium text-muted-foreground disabled:pointer-events-none"
              >
                Call BS
              </button>
              <button
                disabled
                className="h-11 rounded-md bg-secondary px-6 text-sm font-medium text-muted-foreground"
              >
                Claim →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
