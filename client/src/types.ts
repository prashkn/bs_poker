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
  time_per_turn: number;
  max_cards_before_elimination: number;
}

// Game state

export type Phase = "lobby" | "playing" | "game_over";

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
  currentClaim: Claim | null;
  previousClaims: Claim[];

  // BS resolution (set on bs_result, cleared on next round)
  lastBSResult: BSResult | null;

  // End state
  winnerId: string | null;

  // Error
  lastError: string | null;
}
