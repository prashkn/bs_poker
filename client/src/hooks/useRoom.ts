import { useRoomContext } from "@/context/RoomContext";

export function useRoom() {
  const { roomId, playerId, connected, send } = useRoomContext();
  return { roomId, playerId, connected, send };
}

export function useGame() {
  const {
    players, hostId, phase, round, myHand, turnOrder,
    currentTurnPlayerId, currentClaim, previousClaims,
    lastBSResult, winnerId, isMyTurn, alivePlayers, canCallBS,
  } = useRoomContext();
  return {
    players, hostId, phase, round, myHand, turnOrder,
    currentTurnPlayerId, currentClaim, previousClaims,
    lastBSResult, winnerId, isMyTurn, alivePlayers, canCallBS,
  };
}

export function useChat() {
  const { messages, connected, send } = useRoomContext();
  return { messages, connected, send };
}

export function useLog() {
  const { log } = useRoomContext();
  return { log };
}

export function usePlayers() {
  const { players, hostId, playerId, connected, send } = useRoomContext();
  return {
    players: Array.from(players.values()),
    hostId,
    playerId,
    connected,
    send,
  };
}
