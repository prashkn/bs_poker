import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useGameState } from "@/hooks/useGameState";
import type { WSMessage, LogEntry } from "@/hooks/useWebSocket";
import type { PlayerState, Phase, Card, Claim, BSResult } from "@/types";

export interface RoomContextValue {
  // Identity
  roomId: string;
  playerId: string;

  // WebSocket
  connected: boolean;
  send: (msg: WSMessage) => void;
  messages: WSMessage[];
  log: LogEntry[];

  // Game state
  players: Map<string, PlayerState>;
  hostId: string;
  phase: Phase;
  round: number;
  myHand: Card[];
  turnOrder: string[];
  currentTurnPlayerId: string;
  currentClaim: Claim | null;
  previousClaims: Claim[];
  lastBSResult: BSResult | null;
  winnerId: string | null;

  // Derived
  isMyTurn: boolean;
  alivePlayers: PlayerState[];
  canCallBS: boolean;
}

const RoomContext = createContext<RoomContextValue | null>(null);

interface RoomProviderProps {
  roomId: string;
  playerId: string;
  children: ReactNode;
}

export function RoomProvider({ roomId, playerId, children }: RoomProviderProps) {
  const { messages, log, connected, send } = useWebSocket(roomId, playerId);
  const gameState = useGameState(messages, playerId);

  const value = useMemo<RoomContextValue>(
    () => ({
      roomId,
      playerId,
      connected,
      send,
      messages,
      log,
      ...gameState,
    }),
    [roomId, playerId, connected, send, messages, log, gameState],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoomContext(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) {
    throw new Error("useRoomContext must be used within a RoomProvider");
  }
  return ctx;
}
