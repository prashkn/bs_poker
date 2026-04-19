import { useEffect, useMemo, useReducer } from "react";
import type { ServerEmitter } from "./useWebSocket";
import type {
  GameState,
  PlayerState,
  Claim,
  ServerEvent,
  ServerEventMap,
} from "@/types";

const initialState: GameState = {
  players: new Map(),
  hostId: "",
  settings: null,
  phase: "lobby",
  round: 0,
  myHand: [],
  turnOrder: [],
  currentTurnPlayerId: "",
  turnDeadlineMs: null,
  currentClaim: null,
  previousClaims: [],
  lastBSResult: null,
  winnerId: null,
  lastError: null,
};

// Events the game reducer cares about. Chat is subscribed to directly by the
// Chat component and intentionally omitted.
const HANDLED_EVENTS = [
  "room_state",
  "player_joined",
  "player_left",
  "player_disconnected",
  "player_reconnected",
  "host_changed",
  "settings_updated",
  "game_started",
  "turn",
  "claim_made",
  "bs_called",
  "bs_result",
  "round_started",
  "player_eliminated",
  "game_over",
  "error_message",
] as const satisfies readonly ServerEvent[];

type HandledEvent = (typeof HANDLED_EVENTS)[number];

type Action = {
  [K in HandledEvent]: { type: K; payload: ServerEventMap[K] };
}[HandledEvent];

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "room_state": {
      const { host_id, players: list, settings } = action.payload;
      const players = new Map<string, PlayerState>();
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
        hostId: host_id,
        settings: settings ?? null,
        phase: "lobby",
      };
    }

    case "player_joined": {
      const { player_id, name } = action.payload;
      const players = new Map(state.players);
      players.set(player_id, {
        id: player_id,
        name,
        connected: true,
        isAlive: true,
        cardCount: 0,
      });
      return { ...state, players };
    }

    case "player_left": {
      const players = new Map(state.players);
      players.delete(action.payload.player_id);
      return { ...state, players };
    }

    case "player_disconnected": {
      const players = new Map(state.players);
      const existing = players.get(action.payload.player_id);
      if (existing) {
        players.set(action.payload.player_id, { ...existing, connected: false });
      }
      return { ...state, players };
    }

    case "player_reconnected": {
      const players = new Map(state.players);
      const existing = players.get(action.payload.player_id);
      if (existing) {
        players.set(action.payload.player_id, { ...existing, connected: true });
      }
      return { ...state, players };
    }

    case "host_changed":
      return { ...state, hostId: action.payload.player_id };

    case "settings_updated":
      return { ...state, settings: action.payload.settings };

    case "game_started": {
      const { card_counts } = action.payload;
      const players = new Map(state.players);
      for (const [id, player] of players) {
        players.set(id, {
          ...player,
          isAlive: true,
          cardCount: card_counts[id] ?? 0,
        });
      }
      return {
        ...state,
        players,
        phase: "playing",
        round: action.payload.round,
        myHand: action.payload.hand,
        turnOrder: action.payload.turn_order,
        currentTurnPlayerId: action.payload.current_turn,
        turnDeadlineMs: action.payload.turn_deadline_ms,
        currentClaim: null,
        previousClaims: [],
        lastBSResult: null,
        winnerId: null,
      };
    }

    case "turn":
      return {
        ...state,
        currentTurnPlayerId: action.payload.player_id,
        turnDeadlineMs: action.payload.turn_deadline_ms,
      };

    case "claim_made": {
      const claim: Claim = {
        player_id: action.payload.player_id,
        made_hand: action.payload.made_hand,
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
      const result = action.payload;
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
        round: action.payload.round,
        myHand: action.payload.hand,
        currentTurnPlayerId: "",
        turnDeadlineMs: null,
        currentClaim: null,
        previousClaims: [],
        lastBSResult: null,
      };

    case "player_eliminated": {
      const players = new Map(state.players);
      const eliminated = players.get(action.payload.player_id);
      if (eliminated) {
        players.set(action.payload.player_id, { ...eliminated, isAlive: false });
      }
      return { ...state, players };
    }

    case "game_over":
      return {
        ...state,
        phase: "game_over",
        winnerId: action.payload.winner_id,
      };

    case "error_message":
      return { ...state, lastError: action.payload.message };

    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}

export function useGameState(emitter: ServerEmitter, playerId: string) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  useEffect(() => {
    const offs = HANDLED_EVENTS.map((event) =>
      emitter.on(event, (payload) =>
        dispatch({ type: event, payload } as Action),
      ),
    );
    return () => offs.forEach((off) => off());
  }, [emitter]);

  const derived = useMemo(
    () => ({
      isMyTurn: state.currentTurnPlayerId === playerId,
      alivePlayers: Array.from(state.players.values()).filter((p) => p.isAlive),
      canCallBS:
        state.currentTurnPlayerId === playerId && state.currentClaim !== null,
    }),
    [state.currentTurnPlayerId, state.currentClaim, state.players, playerId],
  );

  return { ...state, ...derived };
}
