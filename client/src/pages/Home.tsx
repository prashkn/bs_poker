import { useState } from "react";
import { Link } from "react-router-dom";
import JoinRoomForm from "@/components/JoinRoomForm";
import CreateRoomForm from "@/components/CreateRoomForm";
import { cn } from "@/lib/utils";

const SUIT_GLYPHS: Record<string, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

// The hand fanned out in the corner. Mixed suits and high cards — it reads as a
// real bluff: a hand that looks like more than it is.
const HAND: Array<{ rank: string; suit: keyof typeof SUIT_GLYPHS }> = [
  { rank: "A", suit: "spades" },
  { rank: "K", suit: "hearts" },
  { rank: "Q", suit: "spades" },
  { rank: "J", suit: "diamonds" },
  { rank: "10", suit: "clubs" },
];

function FaceCard({
  rank,
  suit,
}: {
  rank: string;
  suit: keyof typeof SUIT_GLYPHS;
}) {
  const red = suit === "hearts" || suit === "diamonds";
  const glyph = SUIT_GLYPHS[suit];
  const tone = red ? "text-red-600" : "text-zinc-900";
  return (
    <div className="flex h-40 w-28 select-none flex-col justify-between rounded-xl border border-black/10 bg-zinc-50 p-2.5 shadow-[0_22px_45px_-15px_rgba(0,0,0,0.85)]">
      <div className={cn("font-semibold leading-none", tone)}>
        <div className="text-2xl">{rank}</div>
        <div className="-mt-1 text-lg leading-none">{glyph}</div>
      </div>
      <div className={cn("self-center text-4xl leading-none", tone)}>{glyph}</div>
      <div className={cn("rotate-180 font-semibold leading-none", tone)}>
        <div className="text-2xl">{rank}</div>
        <div className="-mt-1 text-lg leading-none">{glyph}</div>
      </div>
    </div>
  );
}

function FannedHand() {
  return (
    <div className="relative h-72 w-72">
      {HAND.map((card, i) => {
        const angle = (i - 2) * 13;
        return (
          <div
            key={card.rank + card.suit}
            className="absolute bottom-0 left-1/2 origin-bottom"
            style={{
              transform: `translateX(-50%) rotate(${angle}deg)`,
              zIndex: i,
            }}
          >
            <div className="deal" style={{ animationDelay: `${340 + i * 95}ms` }}>
              <FaceCard rank={card.rank} suit={card.suit} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<"join" | "create">("join");

  return (
    <main className="grain home-vignette relative min-h-screen overflow-hidden">
      {/* the dealt hand, bleeding off the bottom-right corner */}
      <div className="pointer-events-none absolute -bottom-14 right-2 hidden -rotate-6 md:block lg:right-12 xl:right-24">
        <FannedHand />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 md:px-12">
        <div className="grid flex-1 items-start gap-5 pb-12 pt-8 lg:grid-cols-2 lg:items-center lg:gap-14 lg:py-20">
          {/* hero */}
          <section>
            <h1
              className="rise text-5xl font-bold leading-[0.95] tracking-tight sm:text-6xl md:text-7xl"
              style={{ animationDelay: "0ms" }}
            >
              BS Poker
            </h1>

            <div
              className="rise mt-6 hidden h-px w-16 bg-red-600/80 md:block"
              style={{ animationDelay: "80ms" }}
            />

            <p
              className="rise mt-6 max-w-md text-base leading-relaxed text-muted-foreground md:text-lg"
              style={{ animationDelay: "150ms" }}
            >
              Claim a hand hidden somewhere across everyone&apos;s cards.
              Call BS when the story doesn&apos;t add up.
              The last player standing wins.
            </p>

            <Link
              to="/rules"
              className="rise mt-4 inline-block text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground md:mt-6"
              style={{ animationDelay: "210ms" }}
            >
              How to play
            </Link>
          </section>

          {/* take a seat */}
          <section
            className="rise w-full max-w-sm justify-self-stretch lg:justify-self-end"
            style={{ animationDelay: "300ms" }}
          >
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1">
              {(["join", "create"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={mode === value}
                  className={cn(
                    "rounded-md py-1.5 text-sm font-medium capitalize transition-colors",
                    mode === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {mode === "join" ? <JoinRoomForm /> : <CreateRoomForm />}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
