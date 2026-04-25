package game

import (
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Player struct {
	ID              uuid.UUID       `json:"id"`
	Name            string          `json:"name"`
	Hand            []Card          `json:"hand,omitempty"`
	IsAlive         bool            `json:"is_alive"`
	CardCount       int             `json:"card_count"`
	Mu              sync.Mutex      `json:"-"` // Guards Conn/SendCh/Done/DisconnectTimer during connection swap
	Conn            *websocket.Conn `json:"-"` // WebSocket connection, not serialized
	SendCh          chan []byte     `json:"-"` // Channel for sending messages to the player, not serialized
	Done            chan struct{}   `json:"-"` // Channel to signal player disconnection, not serialized
	DisconnectTimer *time.Timer     `json:"-"` // Pending forfeit/removal after a disconnect; cancelled on reconnect.
}

func NewPlayer(name string) *Player {
	return &Player{
		ID:        uuid.New(),
		Name:      name,
		IsAlive:   true,
		CardCount: 2,
	}
}
