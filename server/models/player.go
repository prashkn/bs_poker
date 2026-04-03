package models

import (
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Player struct {
	ID      uuid.UUID       `json:"id"`
	Name    string          `json:"name"`
	Room    *Room           `json:"-"`
	Hand    []Card          `json:"hand,omitempty"`
	IsAlive bool            `json:"is_alive"`
	Conn    *websocket.Conn `json:"-"`
	SendCh  chan []byte     `json:"-"`
}

func NewPlayer(name string) *Player {
	return &Player{
		ID:      uuid.New(),
		Name:    name,
		IsAlive: true,
		SendCh:  make(chan []byte, 256),
	}
}
