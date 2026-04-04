package models

import (
	"encoding/json"
	"errors"
)

// MessageEvent is the type of ws message
type MessageEvent string

const (
	// Client -> Server
	MessageTypeChat           MessageEvent = "chat"
	MessageTypeStartGame      MessageEvent = "start_game"
	MessageTypeClaim          MessageEvent = "claim"
	MessageTypeCallBS         MessageEvent = "call_bs"
	MessageTypeKickPlayer     MessageEvent = "kick_player"
	MessageTypeUpdateSettings MessageEvent = "update_settings"

	// Server -> Client
	MessageTypeRoomState        MessageEvent = "room_state"
	MessageTypePlayerJoined     MessageEvent = "player_joined"
	MessageTypePlayerLeft       MessageEvent = "player_left"
	MesssageTypeHostChanged     MessageEvent = "host_changed"
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
)

// RawMessage is the routing envelope — extract the event, keep raw payload bytes for per-handler decoding.
type RawMessage struct {
	Event   MessageEvent    `json:"event"`
	Payload json.RawMessage `json:"payload"`
}

// ParseMessage extracts the event and payload fields from a WebSocket message.
func ParseMessage(data []byte) (*RawMessage, error) {
	var msg RawMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, errors.New("invalid JSON message")
	}
	if msg.Event == "" {
		return nil, errors.New("missing or invalid 'event' field")
	}

	return &msg, nil
}

// NewMessage builds a JSON-encoded message with the standard { event, payload } structure.
func NewMessage(event MessageEvent, payload any) ([]byte, error) {
	return json.Marshal(struct {
		Event   MessageEvent `json:"event"`
		Payload any          `json:"payload"`
	}{
		Event:   event,
		Payload: payload,
	})
}

// Client -> Server payloads

type ChatPayload struct {
	Text string `json:"text"`
}

type ClaimPayload struct {
	MadeHand MadeHand `json:"made_hand"`
}

type KickPayload struct {
	PlayerID string `json:"player_id"`
}

type UpdateSettingsPayload struct {
	Settings RoomSettings `json:"settings"`
}
