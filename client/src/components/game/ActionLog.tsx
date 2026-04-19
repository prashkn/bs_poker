export interface LogEntry {
  kind: "round_start" | "claim" | "bs_called" | "bs_result";
  at: string;
  round?: number;
  player?: string;
  hand?: string;
  note?: string;
}

export default function ActionLog({ history }: { history: LogEntry[] }) {
  return (
    <div className="flex h-full flex-col min-h-0">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 shrink-0">
        <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          Round log
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <ul className="flex flex-1 flex-col gap-1.5 scroll-muted overflow-y-auto px-4 py-3 min-h-0">
        {history.length === 0 ? (
          <li className="text-xs text-muted-foreground">No activity yet.</li>
        ) : (
          history.map((h, i) => (
            <li key={i} className="flex items-baseline gap-2 text-xs anim-in">
              <span className="font-mono text-[10px] text-muted-foreground w-10 shrink-0">
                {h.at}
              </span>
              {h.kind === "round_start" ? (
                <span className="text-muted-foreground">
                  — Round {h.round} began —
                </span>
              ) : h.kind === "bs_called" ? (
                <span className="truncate">
                  <span className="font-medium">{h.player}</span>
                  <span className="text-muted-foreground"> called BS</span>
                </span>
              ) : h.kind === "bs_result" ? (
                <span className="truncate text-muted-foreground">— {h.note} —</span>
              ) : (
                <span className="truncate">
                  <span className="font-medium">{h.player}</span>
                  <span className="text-muted-foreground"> claimed </span>
                  <span className="text-foreground/90">{h.hand}</span>
                </span>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
