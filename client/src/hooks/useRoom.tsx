import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useWebSocket, type WSMessage } from "./useWebSocket";
import { useGameState } from "./useGameState";

type GameSlice = ReturnType<typeof useGameState>;

interface RoomContextValue {
  roomId: string;
  playerId: string;
  password: string;
  connected: boolean;
  messages: WSMessage[];
  send: (msg: WSMessage) => void;
  game: GameSlice;
}

const RoomContext = createContext<RoomContextValue | null>(null);

interface RoomProviderProps {
  roomId: string;
  playerId: string;
  children: ReactNode;
}

export function RoomProvider({ roomId, playerId, children }: RoomProviderProps) {
  const { messages, connected, send } = useWebSocket(roomId, playerId);
  const game = useGameState(messages, playerId);

  // Track the latest non-empty password from room_state messages. Empty
  // passwords (sent to non-hosts) don't overwrite — this matters for the
  // host-migration case where a new host receives a targeted room_state.
  const [password, setPassword] = useState("");
  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.event !== "room_state") continue;
      const next = (m.payload.password as string) ?? "";
      if (next) setPassword(next);
      break;
    }
  }, [messages]);

  const value = useMemo<RoomContextValue>(
    () => ({ roomId, playerId, password, connected, messages, send, game }),
    [roomId, playerId, password, connected, messages, send, game]
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
  const { messages, connected, send } = useRoomContext();
  return { messages, connected, send };
}

export function useGame() {
  const { game } = useRoomContext();
  return {
    currentTurnPlayerId: game.currentTurnPlayerId,
    players: game.players,
    isMyTurn: game.isMyTurn,
    canCallBS: game.canCallBS,
    myHand: game.myHand,
    round: game.round,
  };
}
