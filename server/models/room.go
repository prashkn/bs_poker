package models

import (
	"time"

	"github.com/google/uuid"
)

type Room struct {
	ID        string       `json:"id"`
	Password  string       `json:"password,omitempty"`
	HostID    uuid.UUID    `json:"host_id"`
	Players   []*Player    `json:"players"`
	Settings  RoomSettings `json:"room_settings"`
	Game      *Game        `json:"game,omitempty"`
	CreatedAt time.Time    `json:"created_at"`
}

type RoomSettings struct {
	TimePerTurn               time.Duration `json:"time_per_turn"`
	MaxCardsBeforeElimination int           `json:"max_cards_before_elimination"`
}

type Player struct {
	ID      uuid.UUID `json:"id"`
	Name    string    `json:"name"`
	Room    *Room     `json:"room,omitempty"`
	Hand    []Card    `json:"hand,omitempty"`
	IsAlive bool      `json:"is_alive"`
}

type Game struct {
	Deck         []Card      `json:"deck"` // remaining cards in the deck
	Round        int         `json:"round"`
	TurnOrder    []uuid.UUID `json:"turn_order"`   // order of player IDs
	CurrentTurn  int         `json:"current_turn"` // index in TurnOrder
	CurrentClaim *Claim      `json:"current_claim,omitempty"`
	State        GameState   `json:"state"`
}

type GameState int

const (
	StateTurn     GameState = iota // it's a player's turn to make a claim or call BS
	StateBSCalled                  // a BS call has been made, waiting for result
	StateGameOver                  // one player has won, game is over
)
