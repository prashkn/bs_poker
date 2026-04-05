import type { Card as GameCard } from "@/types";

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const VALUE_LABELS: Record<number, string> = {
  11: "J", 12: "Q", 13: "K", 14: "A",
};

export default function PlayingCard({ card }: { card: GameCard }) {
  const suit = SUIT_SYMBOLS[card.suit] ?? "?";
  const value = VALUE_LABELS[card.value] ?? card.value.toString();
  const isRed = card.suit === "hearts" || card.suit === "diamonds";

  return (
    <div
      className={`flex flex-col items-center justify-between rounded-lg border bg-white shadow-sm
        h-28 w-20 p-1.5 select-none ${isRed ? "text-red-600" : "text-gray-900"}`}
    >
      <div className="self-start text-sm font-bold leading-none">
        <div>{value}</div>
        <div>{suit}</div>
      </div>
      <div className="text-3xl">{suit}</div>
      <div className="self-end text-sm font-bold leading-none rotate-180">
        <div>{value}</div>
        <div>{suit}</div>
      </div>
    </div>
  );
}
