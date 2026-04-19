import { useCallback, useMemo, useRef, useState } from "react";
import ActionLog, { type LogEntry } from "@/components/game/ActionLog";
import BSBanner from "@/components/game/BSBanner";
import GameOverScreen from "@/components/game/GameOverScreen";
import InlineChat from "@/components/game/InlineChat";
import MyHandDock from "@/components/game/MyHandDock";
import OpponentCard from "@/components/game/OpponentCard";
import RoomChrome from "@/components/game/RoomChrome";
import TableCenter from "@/components/game/TableCenter";
import { HAND_NAMES } from "@/components/game/primitives";
import { valueLabel } from "@/components/PlayingCard";
import { useGame, useRoom } from "@/hooks/useRoom";
import { useServerEvent } from "@/hooks/useServerEvent";
import { useTurnTimer } from "@/hooks/useTurnTimer";
import type { Claim, MadeHand } from "@/types";

function formatClaim(claim: Claim): string {
  const name = HAND_NAMES[claim.made_hand.hand_type] ?? "Hand";
  const cards = claim.made_hand.cards;
  if (cards.length === 0) return name;
  const high = cards[cards.length - 1];
  return `${name} · high ${valueLabel(high.value)}`;
}

function formatMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function GameBoard() {
  const {
    phase,
    round,
    players,
    alivePlayers,
    myPlayerId,
    currentTurnPlayerId,
    nextTurnPlayerId,
    currentClaim,
    previousClaims,
    lastBSResult,
    myHand,
    isMyTurn,
    canCallBS,
    settings,
    winnerId,
  } = useGame();
  const { roomId, password, isHost, send } = useRoom();
  const { secondsLeft, total: turnTotalSeconds } = useTurnTimer();

  const opponents = useMemo(
    () => Array.from(players.values()).filter((p) => p.id !== myPlayerId),
    [players, myPlayerId],
  );

  const totalCards = useMemo(
    () => alivePlayers.reduce((sum, p) => sum + p.cardCount, 0),
    [alivePlayers],
  );

  // Last claim per player this round (from previousClaims)
  const lastClaimByPlayer = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of previousClaims) {
      map.set(c.player_id, formatClaim(c));
    }
    return map;
  }, [previousClaims]);

  // Round log: derive from previousClaims + local timestamps captured on each
  // claim_made event. Timestamps are anchored to round_started (mm:ss offset).
  const [roundStartTs, setRoundStartTs] = useState<number>(() => Date.now());
  const claimTsRef = useRef<number[]>([]);

  useServerEvent("game_started", () => {
    setRoundStartTs(Date.now());
    claimTsRef.current = [];
  });
  useServerEvent("round_started", () => {
    setRoundStartTs(Date.now());
    claimTsRef.current = [];
  });
  useServerEvent("claim_made", () => {
    claimTsRef.current.push(Date.now());
  });

  const history: LogEntry[] = useMemo(() => {
    const entries: LogEntry[] = [
      {
        kind: "round_start",
        round,
        at: "00:00",
      },
    ];
    previousClaims.forEach((c, i) => {
      const ts = claimTsRef.current[i] ?? roundStartTs;
      const at = formatMmSs(ts - roundStartTs);
      const player = players.get(c.player_id)?.name ?? "player";
      entries.push({
        kind: "claim",
        at,
        player,
        hand: formatClaim(c),
      });
    });
    return entries;
  }, [previousClaims, round, roundStartTs, players]);

  // BS banner visibility — dismiss locally when user clicks "next round". Also
  // auto-resets when the server pushes a new bs_result (different loser or new
  // instance).
  const [dismissedBsKey, setDismissedBsKey] = useState<string | null>(null);
  const bsKey = lastBSResult
    ? `${lastBSResult.caller_id}->${lastBSResult.target_id}:${lastBSResult.loser_id}`
    : null;
  const showBsBanner = lastBSResult !== null && dismissedBsKey !== bsKey;

  const handleClaim = useCallback(
    (madeHand: MadeHand) => {
      send("claim", { made_hand: madeHand });
    },
    [send],
  );

  const handleCallBS = useCallback(() => {
    send("call_bs", {});
  }, [send]);

  const handlePlayAgain = useCallback(() => {
    if (isHost) send("start_game", {});
  }, [isHost, send]);

  const winner = winnerId ? (players.get(winnerId) ?? null) : null;
  const gameOver = phase === "game_over";

  return (
    <div className="flex h-screen min-h-screen flex-col bg-background no-tap-highlight">
      <RoomChrome
        roomId={roomId}
        password={password}
        settings={settings}
        alivePlayerCount={alivePlayers.length}
        round={round}
        totalCards={totalCards}
      />

      <div className="flex flex-1 min-h-0">
        <div className="flex flex-1 min-w-0 flex-col">
          <div className="flex items-stretch gap-3 px-6 py-4 overflow-x-auto scroll-muted shrink-0">
            {opponents.map((p) => (
              <div key={p.id} className="w-44 shrink-0">
                <OpponentCard
                  player={p}
                  isCurrentTurn={currentTurnPlayerId === p.id}
                  turnSecondsLeft={secondsLeft}
                  turnTotalSeconds={turnTotalSeconds}
                  lastClaimText={lastClaimByPlayer.get(p.id)}
                />
              </div>
            ))}
            {opponents.length === 0 && (
              <div className="flex h-24 w-full items-center justify-center text-xs text-muted-foreground">
                No other players at the table.
              </div>
            )}
          </div>

          <div className="flex flex-1 min-h-[320px] px-6 pb-4">
            <div className="flex-1 rounded-md border border-border bg-card overflow-hidden felt">
              {gameOver ? (
                <GameOverScreen
                  winner={winner}
                  isHost={isHost}
                  onPlayAgain={handlePlayAgain}
                />
              ) : (
                <TableCenter
                  claim={currentClaim}
                  players={players}
                  currentTurnPlayerId={currentTurnPlayerId}
                  nextPlayerId={nextTurnPlayerId}
                />
              )}
            </div>
          </div>

          <div className="border-t border-border bg-card/50 shrink-0 px-6 py-5">
            <MyHandDock
              playerId={myPlayerId}
              playerName={players.get(myPlayerId)?.name ?? "You"}
              hand={myHand}
              isMyTurn={isMyTurn && !gameOver}
              canCallBS={canCallBS && !gameOver}
              onClaim={handleClaim}
              onCallBS={handleCallBS}
              currentClaim={currentClaim}
              turnSecondsLeft={secondsLeft}
              turnTotalSeconds={turnTotalSeconds}
            />
          </div>
        </div>

        <aside className="w-64 shrink-0 border-l border-border bg-card/40 flex flex-col min-h-0">
          <div
            className="flex-1 min-h-0 flex flex-col border-b border-border"
            style={{ flexBasis: "55%" }}
          >
            <ActionLog history={history} />
          </div>
          <div
            className="flex-1 min-h-0 flex flex-col"
            style={{ flexBasis: "45%" }}
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 shrink-0">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                Chat
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="flex-1 min-h-0 px-4 py-3">
              <InlineChat />
            </div>
          </div>
        </aside>
      </div>

      {showBsBanner && lastBSResult && (
        <BSBanner
          result={lastBSResult}
          players={players}
          onDismiss={() => setDismissedBsKey(bsKey)}
        />
      )}
    </div>
  );
}
