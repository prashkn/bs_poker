package models

import "time"

type MessageType string

const (
	MessageTypeClaim          MessageType = "claim"
	MessageTypeCallBS         MessageType = "call_bs"
	MessageTypeChat           MessageType = "chat"
	MessageTypeStartGame      MessageType = "start_game"
	MessageTypeKickPlayer     MessageType = "kick_player"
	MessageTypeUpdateSettings MessageType = "update_settings"
)

type Message struct {
	ID        string      `json:"id"`
	Type      MessageType `json:"message_type"`
	Content   string      `json:"content"`
	CreatedAt time.Time   `json:"created_at"`
}
