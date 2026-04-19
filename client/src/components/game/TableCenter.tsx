import PlayingCard, { valueLabel } from "@/components/PlayingCard";
import { AvatarImg, HAND_NAMES } from "@/components/game/primitives";
import type { Claim, PlayerState } from "@/types";

const HAND_LADDER = [
  { v: 1, label: "High Card" },
  { v: 2, label: "Pair" },
  { v: 3, label: "Two Pair" },
  { v: 4, label: "Three of a Kind" },
  { v: 5, label: "Straight" },
  { v: 6, label: "Flush" },
  { v: 7, label: "Full House" },
  { v: 8, label: "Four of a Kind" },
  { v: 9, label: "Straight Flush" },
  { v: 10, label: "Royal Flush" },
];

interface TableCenterProps {
  claim: Claim | null;
  players: Map<string, PlayerState>;
  currentTurnPlayerId: string;
  nextPlayerId: string;
}

export default function TableCenter({
  claim,
  players,
  currentTurnPlayerId,
  nextPlayerId,
}: TableCenterProps) {
  const claimer = claim ? players.get(claim.player_id) ?? null : null;
  const nextPlayer = nextPlayerId ? players.get(nextPlayerId) ?? null : null;
  const handType = claim?.made_hand.hand_type ?? 0;
  const handName = HAND_NAMES[handType] ?? "—";

  // First turn of a round — no claim yet; show an opener placeholder instead
  // of the claimer → next-player layout.
  if (!claim) {
    const opener = currentTurnPlayerId
      ? players.get(currentTurnPlayerId) ?? null
      : null;
    return (
      <div className="relative flex h-full flex-col">
        <div className="relative flex flex-1 items-center justify-center px-8 pt-6 pb-4">
          <div className="flex flex-col items-center gap-2 text-center">
            {opener && (
              <AvatarImg seed={opener.id} name={opener.name} size={52} />
            )}
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Round open
            </span>
            <span className="text-sm font-medium">
              Waiting for {opener?.name ?? "first player"} to claim
            </span>
          </div>
        </div>
        <HandLadder handType={0} />
      </div>
    );
  }

  const highCard = claim.made_hand.cards[claim.made_hand.cards.length - 1];
  const highLabel = highCard ? valueLabel(highCard.value) : "";

  return (
    <div className="relative flex h-full flex-col">
      <div
        className="pointer-events-none absolute inset-4 rounded-[24px] opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(0 0% 100% / 0.025) 0%, transparent 70%)",
          boxShadow: "inset 0 0 0 1px hsl(0 0% 100% / 0.03)",
        }}
      />

      <div className="relative flex flex-1 items-center justify-center gap-8 px-8 pt-6 pb-4">
        <div className="flex w-32 shrink-0 flex-col items-center gap-2 text-center">
          {claimer && (
            <AvatarImg seed={claimer.id} name={claimer.name} size={52} />
          )}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Claimed by
            </span>
            <span className="text-sm font-medium">{claimer?.name ?? "—"}</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <svg viewBox="0 0 40 10" className="h-2 w-12">
            <path
              d="M0 5 L34 5 M30 1 L35 5 L30 9"
              stroke="currentColor"
              strokeWidth="1.2"
              fill="none"
            />
          </svg>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tracking-tight">
              {handName}
            </span>
            {highCard && (
              <span className="font-mono text-xs text-muted-foreground">
                high {highLabel}
              </span>
            )}
          </div>
          <div className="flex items-end gap-1.5">
            {claim.made_hand.cards.map((c, i, arr) => {
              const mid = (arr.length - 1) / 2;
              const rot = (i - mid) * 2.5;
              const ty = Math.abs(i - mid) * 2;
              return (
                <div
                  key={i}
                  className="anim-in"
                  style={{
                    transform: `translateY(${ty}px) rotate(${rot}deg)`,
                    animationDelay: `${i * 60}ms`,
                  }}
                >
                  <PlayingCard card={c} size="md" />
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <svg viewBox="0 0 40 10" className="h-2 w-12">
            <path
              d="M0 5 L34 5 M30 1 L35 5 L30 9"
              stroke="currentColor"
              strokeWidth="1.2"
              fill="none"
            />
          </svg>
        </div>

        <div className="flex w-32 shrink-0 flex-col items-center gap-2 text-center">
          {nextPlayer ? (
            <div className="relative">
              <AvatarImg seed={nextPlayer.id} name={nextPlayer.name} size={52} />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-background animate-pulse" />
              </span>
            </div>
          ) : (
            <div className="h-[52px] w-[52px] rounded-full bg-secondary" />
          )}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-foreground">
              Must beat it
            </span>
            <span className="text-sm font-medium">{nextPlayer?.name ?? "—"}</span>
          </div>
        </div>
      </div>

      <HandLadder handType={handType} />
    </div>
  );
}

function HandLadder({ handType }: { handType: number }) {
  return (
    <div className="relative border-t border-border/60 px-8 pb-4 pt-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          Ranks still open
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          ← must outrank →
        </span>
      </div>
      <div className="flex items-stretch gap-0">
        {HAND_LADDER.map((h) => {
          const beaten = h.v < handType;
          const current = h.v === handType;
          return (
            <div key={h.v} className="relative flex-1">
              <div className="flex flex-col items-center gap-1 px-1 py-1.5">
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    beaten
                      ? "text-muted-foreground/40"
                      : current
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {String(h.v).padStart(2, "0")}
                </span>
                <div
                  className={`h-1 w-full rounded-full ${
                    current
                      ? "bg-foreground"
                      : beaten
                        ? "bg-border/60"
                        : "bg-secondary"
                  }`}
                />
                <span
                  className={`truncate text-[10px] ${
                    beaten
                      ? "text-muted-foreground/50 line-through"
                      : current
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                  }`}
                >
                  {h.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
