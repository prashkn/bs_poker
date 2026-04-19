import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useWebSocket,
  type SendFn,
  type ServerEmitter,
} from "./useWebSocket";
import { useGameState } from "./useGameState";

type GameSlice = ReturnType<typeof useGameState>;

interface RoomContextValue {
  roomId: string;
  playerId: string;
  password: string;
  connected: boolean;
  emitter: ServerEmitter;
  send: SendFn;
  game: GameSlice;
}

export const RoomContext = createContext<RoomContextValue | null>(null);

interface RoomProviderProps {
  roomId: string;
  playerId: string;
  children: ReactNode;
}

export function RoomProvider({ roomId, playerId, children }: RoomProviderProps) {
  const { emitter, connected, send } = useWebSocket(roomId, playerId);
  const game = useGameState(emitter, playerId);

  // Hosts receive a non-empty password in room_state; non-hosts get "". Keep
  // the latest non-empty value so host migration doesn't wipe the password
  // the user has already seen.
  const [password, setPassword] = useState("");
  useEffect(() => {
    return emitter.on("room_state", (payload) => {
      if (payload.password) setPassword(payload.password);
    });
  }, [emitter]);

  const value = useMemo<RoomContextValue>(
    () => ({ roomId, playerId, password, connected, emitter, send, game }),
    [roomId, playerId, password, connected, emitter, send, game],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

function useRoomContext(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom hooks must be used inside <RoomProvider>");
  return ctx;
}

export function useRoom() {
  const { roomId, playerId, password, connected, send, game } = useRoomContext();
  return {
    roomId,
    playerId,
    password,
    hostId: game.hostId,
    isHost: game.hostId !== "" && game.hostId === playerId,
    connected,
    send,
  };
}

export function usePlayers() {
  const { playerId, connected, send, game } = useRoomContext();
  const players = useMemo(() => Array.from(game.players.values()), [game.players]);
  return { players, hostId: game.hostId, playerId, connected, send };
}

export function useChat() {
  const { connected, send } = useRoomContext();
  return { connected, send };
}

export function useGame() {
  const { game, playerId } = useRoomContext();

  // Next alive player in turn order after the current one. Used to show the
  // "must beat it" indicator in TableCenter.
  const nextTurnPlayerId = useMemo(() => {
    const order = game.turnOrder;
    if (order.length === 0) return "";
    const start = order.indexOf(game.currentTurnPlayerId);
    if (start === -1) return order[0] ?? "";
    for (let i = 1; i <= order.length; i++) {
      const candidate = order[(start + i) % order.length];
      const p = game.players.get(candidate);
      if (p?.isAlive) return candidate;
    }
    return "";
  }, [game.turnOrder, game.currentTurnPlayerId, game.players]);

  return {
    phase: game.phase,
    currentTurnPlayerId: game.currentTurnPlayerId,
    players: game.players,
    alivePlayers: game.alivePlayers,
    turnOrder: game.turnOrder,
    nextTurnPlayerId,
    myPlayerId: playerId,
    isMyTurn: game.isMyTurn,
    canCallBS: game.canCallBS,
    myHand: game.myHand,
    round: game.round,
    currentClaim: game.currentClaim,
    previousClaims: game.previousClaims,
    lastBSResult: game.lastBSResult,
    settings: game.settings,
    winnerId: game.winnerId,
    turnDeadlineMs: game.turnDeadlineMs,
  };
}
