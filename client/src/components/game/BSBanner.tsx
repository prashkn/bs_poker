import PlayingCard from "@/components/PlayingCard";
import { AvatarImg, Pill } from "@/components/game/primitives";
import type { BSResult, PlayerState } from "@/types";

interface BSBannerProps {
  result: BSResult;
  players: Map<string, PlayerState>;
  onDismiss: () => void;
}

export default function BSBanner({ result, players, onDismiss }: BSBannerProps) {
  const caller = players.get(result.caller_id)?.name ?? "Someone";
  const target = players.get(result.target_id)?.name ?? "someone";
  const loser = players.get(result.loser_id)?.name ?? "loser";
  const headline = result.claim_valid ? "Claim held" : "BS!";
  const description = result.claim_valid
    ? `The claim was in the table. ${caller} takes +1 card.`
    : `The claim wasn't there. ${target} takes +1 card.`;

  const handEntries = Object.entries(result.all_hands ?? {});

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm anim-in">
      <div className="flex flex-col items-center gap-6 rounded-lg border border-border bg-card p-10 shadow-2xl max-w-3xl max-h-[90vh] overflow-y-auto scroll-muted">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            {caller} called BS on {target}
          </span>
          <h2 className="bs-pulse font-mono text-7xl font-bold tracking-tight">
            {headline}
          </h2>
          <span className="text-sm text-muted-foreground">{description}</span>
          {loser && (
            <span className="mt-1 text-xs text-red-300">{loser} takes +1 card</span>
          )}
        </div>

        {handEntries.length > 0 && (
          <div className="flex flex-wrap items-start justify-center gap-6">
            {handEntries.map(([pid, cards], idx) => {
              const p = players.get(pid);
              const isLoser = pid === result.loser_id;
              return (
                <div key={pid} className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <AvatarImg seed={pid} name={p?.name} size={18} />
                    <span
                      className={`text-xs ${
                        isLoser ? "text-red-300" : "text-muted-foreground"
                      }`}
                    >
                      {p?.name ?? pid}
                    </span>
                    {isLoser && <Pill tone="danger">+1 card</Pill>}
                  </div>
                  <div className="flex gap-1">
                    {cards.map((c, i) => (
                      <div
                        key={i}
                        className="card-flip"
                        style={{ animationDelay: `${idx * 120 + i * 90}ms` }}
                      >
                        <PlayingCard card={c} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={onDismiss}
          className="h-9 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Next round →
        </button>
      </div>
    </div>
  );
}
