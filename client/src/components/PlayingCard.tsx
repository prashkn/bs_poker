import type { Card as GameCard } from "@/types";

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
  spades: "\u2660",
};

const VALUE_LABELS: Record<number, string> = {
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

export type PlayingCardSize = "xs" | "sm" | "md" | "lg";

const DIMENSIONS: Record<PlayingCardSize, string> = {
  xs: "h-10 w-7 text-[6px] rounded-[3px] p-0.5",
  sm: "h-14 w-10 text-[8px] rounded-[4px] p-1",
  md: "h-20 w-14 text-[11px] rounded-md p-1.5",
  lg: "h-28 w-20 text-sm rounded-lg p-2",
};

const CENTER_SIZE: Record<PlayingCardSize, string> = {
  xs: "text-[10px]",
  sm: "text-sm",
  md: "text-xl",
  lg: "text-2xl",
};

export function valueLabel(v: number): string {
  return VALUE_LABELS[v] ?? String(v);
}

export function suitGlyph(s: string): string {
  return SUIT_SYMBOLS[s] ?? "?";
}

export function isRedSuit(s: string): boolean {
  return s === "hearts" || s === "diamonds";
}

interface PlayingCardProps {
  card: GameCard;
  size?: PlayingCardSize;
  className?: string;
}

export default function PlayingCard({
  card,
  size = "md",
  className = "",
}: PlayingCardProps) {
  const tone = isRedSuit(card.suit) ? "text-red-600" : "text-zinc-900";
  const label = valueLabel(card.value);
  const glyph = suitGlyph(card.suit);
  return (
    <div
      className={`flex flex-col items-center justify-between overflow-hidden bg-white shadow-sm border border-white/10 select-none ${DIMENSIONS[size]} ${tone} ${className}`}
    >
      <div className="self-start leading-none font-semibold">
        <div>{label}</div>
        <div>{glyph}</div>
      </div>
      <div className={`${CENTER_SIZE[size]} leading-none`}>{glyph}</div>
      <div className="self-end leading-none font-semibold rotate-180">
        <div>{label}</div>
        <div>{glyph}</div>
      </div>
    </div>
  );
}
