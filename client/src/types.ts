// Card and hand types matching the server

export interface Card {
  suit: string;
  value: number;
}

export interface MadeHand {
  hand_type: number;
  cards: Card[];
}

export interface Claim {
  player_id: string;
  made_hand: MadeHand;
}

// Player state

export interface PlayerInfo {
  id: string;
  name: string;
  connected: boolean;
}

export interface PlayerState extends PlayerInfo {
  isAlive: boolean;
  cardCount: number;
}

// BS resolution

export interface BSResult {
  caller_id: string;
  target_id: string;
  all_hands: Record<string, Card[]>;
  claim_valid: boolean;
  loser_id: string;
}

// Room settings (matches server RoomSettings)

export interface RoomSettings {
  // Nanoseconds — Go's time.Duration serializes as int64 ns.
  time_per_turn: number;
  max_cards_before_elimination: number;
}

// Game state

export type Phase = "lobby" | "playing" | "game_over";

// Server -> Client event payloads. Add a new entry here when the server starts
// emitting a new event; that's the only place a wire-level change needs to
// land to become type-safe everywhere it's subscribed.
export type ServerEventMap = {
  room_state: {
    host_id: string;
    players: PlayerInfo[];
    password?: string;
    settings?: RoomSettings;
  };
  player_joined: { player_id: string; name: string };
  player_left: { player_id: string };
  player_kicked: { player_id: string };
  kicked: Record<string, never>;
  player_disconnected: { player_id: string };
  player_reconnected: { player_id: string };
  host_changed: { player_id: string };
  settings_updated: { settings: RoomSettings };
  chat_received: { player_id: string; name: string; text: string };
  game_started: {
    hand: Card[];
    round: number;
    turn_order: string[];
    current_turn: string;
    card_counts: Record<string, number>;
    turn_deadline_ms: number;
  };
  turn: { player_id: string; turn_deadline_ms: number };
  claim_made: { player_id: string; made_hand: MadeHand };
  bs_called: Record<string, never>;
  bs_result: BSResult;
  round_started: { round: number; hand: Card[] };
  player_eliminated: { player_id: string };
  game_over: { winner_id: string };
  error_message: { message: string };
};

export type ServerEvent = keyof ServerEventMap;

// Client -> Server event payloads. Mirrors the handlers in server/handler_ws_events.go.
export type ClientEventMap = {
  chat: { text: string };
  start_game: Record<string, never>;
  claim: { made_hand: MadeHand };
  call_bs: Record<string, never>;
  kick_player: { player_id: string };
  update_settings: { settings: RoomSettings };
};

export type ClientEvent = keyof ClientEventMap;

export interface GameState {
  // Room
  players: Map<string, PlayerState>;
  hostId: string;
  settings: RoomSettings | null;

  // Game
  phase: Phase;
  round: number;
  myHand: Card[];
  turnOrder: string[];
  currentTurnPlayerId: string;
  // Unix ms deadline for the current turn. Server-authoritative; client
  // interpolates max(0, deadline - now) for the countdown display.
  turnDeadlineMs: number | null;
  currentClaim: Claim | null;
  previousClaims: Claim[];

  // BS resolution (set on bs_result, cleared on next round)
  lastBSResult: BSResult | null;

  // End state
  winnerId: string | null;

  // Error
  lastError: string | null;
}
