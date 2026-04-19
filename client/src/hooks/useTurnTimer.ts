import { useEffect, useState } from "react";
import { useGame } from "@/hooks/useRoom";

const DEFAULT_TURN_SECONDS = 45;

// Server-authoritative turn timer. The server sets `turnDeadlineMs` (unix ms)
// on each turn event; the client interpolates remaining time locally. No local
// reset logic — a fresh deadline from the server is the only way to restart
// the countdown, which keeps all clients and the server's timeout enforcement
// in agreement.
export function useTurnTimer(): { secondsLeft: number; total: number } {
  const { settings, turnDeadlineMs } = useGame();
  const total = settings
    ? Math.round(settings.time_per_turn / 1e9)
    : DEFAULT_TURN_SECONDS;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (turnDeadlineMs === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [turnDeadlineMs]);

  const secondsLeft =
    turnDeadlineMs === null
      ? total
      : Math.max(0, Math.ceil((turnDeadlineMs - now) / 1000));

  return { secondsLeft, total };
}
