import type { PlayingCardSize } from "@/components/PlayingCard";
import { avatarUrl } from "@/lib/avatar";

export const HAND_NAMES: Record<number, string> = {
  1: "High Card",
  2: "Pair",
  3: "Two Pair",
  4: "Three of a Kind",
  5: "Straight",
  6: "Flush",
  7: "Full House",
  8: "Four of a Kind",
  9: "Straight Flush",
  10: "Royal Flush",
};

const BACK_DIMENSIONS: Record<PlayingCardSize, string> = {
  xs: "h-10 w-7 rounded-[3px]",
  sm: "h-14 w-10 rounded-[4px]",
  md: "h-20 w-14 rounded-md",
  lg: "h-28 w-20 rounded-lg",
};

export function CardBack({
  size = "md",
  className = "",
}: {
  size?: PlayingCardSize;
  className?: string;
}) {
  return (
    <div className={`card-back border border-zinc-800 ${BACK_DIMENSIONS[size]} ${className}`} />
  );
}

const OVERLAP: Record<PlayingCardSize, number> = {
  xs: -14,
  sm: -24,
  md: -32,
  lg: -40,
};

type CardCountMode = "chips" | "backs";

export function CardCountVisual({
  count,
  size = "sm",
  mode = "chips",
}: {
  count: number;
  size?: PlayingCardSize;
  mode?: CardCountMode;
}) {
  if (mode === "chips") {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-xs font-mono text-muted-foreground">
        <svg
          viewBox="0 0 16 16"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="2.5" y="2" width="8" height="11" rx="1" />
          <rect x="5.5" y="3" width="8" height="11" rx="1" fill="hsl(0 0% 10%)" />
        </svg>
        <span>{count}</span>
      </div>
    );
  }

  const overlap = OVERLAP[size];
  const visible = Math.min(count, 6);
  const items = Array.from({ length: visible });
  return (
    <div className="flex items-center">
      {items.map((_, i) => (
        <div
          key={i}
          style={{
            marginLeft: i === 0 ? 0 : overlap,
            transform: `rotate(${(i - (items.length - 1) / 2) * 4}deg)`,
          }}
        >
          <CardBack size={size} />
        </div>
      ))}
      {count > visible && (
        <span className="ml-1 text-xs font-mono text-muted-foreground">
          +{count - visible}
        </span>
      )}
    </div>
  );
}

export function AvatarImg({
  seed,
  name,
  size = 32,
  className = "",
}: {
  seed: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={avatarUrl(seed)}
      alt={name ?? seed}
      width={size}
      height={size}
      className={`rounded-full bg-secondary ${className}`}
    />
  );
}

export function TurnTimer({
  secondsLeft,
  total,
  compact = false,
}: {
  secondsLeft: number;
  total: number;
  compact?: boolean;
}) {
  const pct = total > 0 ? Math.max(0, Math.min(1, secondsLeft / total)) : 0;
  const danger = secondsLeft <= 10;
  const display = String(Math.max(0, Math.floor(secondsLeft))).padStart(2, "0");

  if (compact) {
    return (
      <div className="flex w-20 flex-col gap-1">
        <div className="flex justify-center">
          <span
            className={`font-mono text-xs ${danger ? "text-red-400" : "text-foreground"}`}
          >
            {display}s
          </span>
        </div>
        <div className="h-0.5 w-full bg-secondary overflow-hidden">
          <div
            className={`h-full ${danger ? "bg-red-400" : "bg-foreground"}`}
            style={{ width: `${pct * 100}%`, transition: "width 900ms linear" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Turn time
        </span>
        <span
          className={`font-mono text-xs ${danger ? "text-red-400" : "text-foreground"}`}
        >
          {display}s
        </span>
      </div>
      <div className="h-0.5 w-full bg-secondary overflow-hidden">
        <div
          className={`h-full ${danger ? "bg-red-400" : "bg-foreground"}`}
          style={{ width: `${pct * 100}%`, transition: "width 900ms linear" }}
        />
      </div>
    </div>
  );
}

type PillTone = "default" | "active" | "danger" | "muted";

const PILL_TONES: Record<PillTone, string> = {
  default: "border-border bg-secondary/60 text-muted-foreground",
  active: "border-foreground/80 bg-foreground text-background",
  danger: "border-red-500/40 bg-red-500/10 text-red-300",
  muted: "border-border bg-transparent text-muted-foreground",
};

export function Pill({
  children,
  tone = "default",
  className = "",
}: {
  children: React.ReactNode;
  tone?: PillTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${PILL_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function SectionLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground ${className}`}
    >
      <span>{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
