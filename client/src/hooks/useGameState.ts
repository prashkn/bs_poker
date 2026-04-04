import { useEffect, useMemo, useRef, useReducer } from "react";
import type { WSMessage } from "./useWebSocket";
import type {
  GameState,
  PlayerInfo,
  PlayerState,
  Claim,
  Card,
  BSResult,
} from "@/types";

const initialState: GameState = {
  players: new Map(),
  hostId: "",
  phase: "lobby",
  round: 0,
  myHand: [],
  turnOrder: [],
  currentTurnPlayerId: "",
  currentClaim: null,
  previousClaims: [],
  lastBSResult: null,
  winnerId: null,
};

type Action = { type: string; payload: Record<string, unknown> };

function gameReducer(state: GameState, action: Action): GameState {
  const p = action.payload;

  switch (action.type) {
    case "room_state": {
      const players = new Map<string, PlayerState>();
      const list = p.players as PlayerInfo[];
      for (const player of list) {
        players.set(player.id, {
          ...player,
          isAlive: true,
          cardCount: 0,
        });
      }
      return {
        ...state,
        players,
        hostId: p.host_id as string,
        phase: "lobby",
      };
    }

    case "player_joined": {
      const players = new Map(state.players);
      players.set(p.player_id as string, {
        id: p.player_id as string,
        name: p.name as string,
        isAlive: true,
        cardCount: 0,
      });
      return { ...state, players };
    }

    case "player_left": {
      const players = new Map(state.players);
      players.delete(p.player_id as string);
      return { ...state, players };
    }

    case "host_changed":
      return { ...state, hostId: p.player_id as string };

    case "game_started":
      return {
        ...state,
        phase: "playing",
        round: 1,
        myHand: p.hand as Card[],
        turnOrder: p.turn_order as string[],
        currentTurnPlayerId: "",
        currentClaim: null,
        previousClaims: [],
        lastBSResult: null,
        winnerId: null,
      };

    case "turn":
      return {
        ...state,
        currentTurnPlayerId: p.player_id as string,
      };

    case "claim_made": {
      const claim: Claim = {
        player_id: p.player_id as string,
        made_hand: p.made_hand as Claim["made_hand"],
      };
      return {
        ...state,
        currentClaim: claim,
        previousClaims: [...state.previousClaims, claim],
      };
    }

    case "bs_called":
      return state;

    case "bs_result": {
      const result = p as unknown as BSResult;
      const players = new Map(state.players);
      const loser = players.get(result.loser_id);
      if (loser) {
        players.set(result.loser_id, {
          ...loser,
          cardCount: loser.cardCount + 1,
        });
      }
      return { ...state, players, lastBSResult: result };
    }

    case "round_started":
      return {
        ...state,
        round: p.round as number,
        myHand: p.hand as Card[],
        currentTurnPlayerId: "",
        currentClaim: null,
        previousClaims: [],
        lastBSResult: null,
      };

    case "player_eliminated": {
      const players = new Map(state.players);
      const eliminated = players.get(p.player_id as string);
      if (eliminated) {
        players.set(p.player_id as string, {
          ...eliminated,
          isAlive: false,
        });
      }
      return { ...state, players };
    }

    case "game_over":
      return {
        ...state,
        phase: "game_over",
        winnerId: p.winner_id as string,
      };

    default:
      return state;
  }
}

export function useGameState(messages: WSMessage[], playerId: string) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const lastProcessed = useRef(0);

  useEffect(() => {
    const newMessages = messages.slice(lastProcessed.current);
    lastProcessed.current = messages.length;
    for (const msg of newMessages) {
      dispatch({ type: msg.event, payload: msg.payload });
    }
  }, [messages]);

  const derived = useMemo(() => ({
    isMyTurn: state.currentTurnPlayerId === playerId,
    alivePlayers: Array.from(state.players.values()).filter((p) => p.isAlive),
    canCallBS: state.currentTurnPlayerId === playerId && state.currentClaim !== null,
  }), [state.currentTurnPlayerId, state.currentClaim, state.players, playerId]);

  return { ...state, ...derived };
}
