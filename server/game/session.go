package game

import "github.com/google/uuid"

// Session represents the state of an active game session.
type Session struct {
	Deck        []Card       `json:"deck"` // remaining cards in the deck
	Round       int          `json:"round"`
	TurnOrder   []uuid.UUID  `json:"turn_order"`   // order of player IDs
	CurrentTurn int          `json:"current_turn"` // index in TurnOrder
	LastClaim   *Claim       `json:"last_claim,omitempty"`
	SM          StateMachine `json:"state"`
}
