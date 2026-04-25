package game

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

type Room struct {
	Mu         sync.Mutex               `json:"-"`
	ID         string                   `json:"id"` // human-readable ID, "blue-tiger-boat"
	Password   string                   `json:"password"`
	HostID     uuid.UUID                `json:"host_id"`
	Players    map[uuid.UUID]*Player    `json:"players"`
	KickedIDs  map[uuid.UUID]struct{}   `json:"-"` // player IDs banned from rejoining this room
	Settings   RoomSettings             `json:"room_settings"`
	Session    *Session                 `json:"session,omitempty"`
	CreatedAt  time.Time                `json:"created_at"`
}

type RoomSettings struct {
	TimePerTurn               time.Duration `json:"time_per_turn"`
	MaxCardsBeforeElimination int           `json:"max_cards_before_elimination"`
}
