package models

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

// MessageEvent is the type of message being sent via websocket
type MessageEvent string

const (
	MessageTypeClaim            MessageEvent = "claim"
	MessageTypeCallBS           MessageEvent = "call_bs"
	MessageTypeChat             MessageEvent = "chat"
	MessageTypeStartGame        MessageEvent = "start_game"
	MessageTypeKickPlayer       MessageEvent = "kick_player"
	MessageTypeUpdateSettings   MessageEvent = "update_settings"
	MessageTypeRoomState        MessageEvent = "room_state"
	MessageTypePlayerJoined     MessageEvent = "player_joined"
	MessageTypeGameStarted      MessageEvent = "game_started"
	MessageTypeTurn             MessageEvent = "turn"
	MessageTypeClaimMade        MessageEvent = "claim_made"
	MessageTypeBSCalled         MessageEvent = "bs_called"
	MessageTypeBSResult         MessageEvent = "bs_result"
	MessageTypeRoundStarted     MessageEvent = "round_started"
	MessageTypePlayerEliminated MessageEvent = "player_eliminated"
	MessageTypeGameOver         MessageEvent = "game_over"
	MessageTypeChatReceived     MessageEvent = "chat_received"
	MessageTypeSettingsUpdated  MessageEvent = "settings_updated"
	MessageTypeErrorMessage     MessageEvent = "error_message"
	MessageTypePlayerLeft       MessageEvent = "player_left"
	MesssageTypeHostChanged     MessageEvent = "host_changed"
)

type Message struct {
	ID        uuid.UUID              `json:"id"`
	Event     MessageEvent           `json:"event"`
	Payload   map[string]interface{} `json:"-"`
	CreatedAt time.Time              `json:"created_at"`
}

func ParseMessage(data []byte) (*Message, error) {
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, errors.New("invalid JSON message")
	}

	event, ok := raw["event"].(string)
	if !ok || event == "" {
		return nil, errors.New("missing or invalid 'event' field")
	}

	return &Message{
		ID:        uuid.New(),
		Event:     MessageEvent(event),
		Payload:   raw,
		CreatedAt: time.Now(),
	}, nil
}
