package game

import (
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Player struct {
	ID        uuid.UUID       `json:"id"`
	Name      string          `json:"name"`
	Room      *Room           `json:"-"`
	Hand      []Card          `json:"hand,omitempty"`
	IsAlive   bool            `json:"is_alive"`
	CardCount int             `json:"card_count"`
	Conn      *websocket.Conn `json:"-"`
	SendCh    chan []byte     `json:"-"`
	Done      chan struct{}   `json:"-"`
}

func NewPlayer(name string) *Player {
	return &Player{
		ID:        uuid.New(),
		Name:      name,
		IsAlive:   true,
		CardCount: 2,
		SendCh:    make(chan []byte, 256),
		Done:      make(chan struct{}),
	}
}
