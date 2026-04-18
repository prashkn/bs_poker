package game

import (
	"encoding/json"
	"errors"

	"github.com/google/uuid"
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
func newMessage(event MessageEvent, payload any) []byte {
	data, _ := json.Marshal(struct {
		Event   MessageEvent `json:"event"`
		Payload any          `json:"payload"`
	}{
		Event:   event,
		Payload: payload,
	})
	return data
}

// Server -> Client message constructors

func NewGameStartedMessage(hand []Card, currentTurn uuid.UUID, round int, turnOrder []uuid.UUID, cardCounts map[uuid.UUID]int) []byte {
	return newMessage(MessageTypeGameStarted, map[string]any{
		"hand":         hand,
		"current_turn": currentTurn.String(),
		"round":        round,
		"turn_order":   turnOrder,
		"card_counts":  cardCounts,
	})
}

func NewPlayerJoinedMessage(playerID uuid.UUID, name string) []byte {
	return newMessage(MessageTypePlayerJoined, map[string]any{
		"player_id": playerID.String(),
		"name":      name,
	})
}

func NewPlayerLeftMessage(playerID uuid.UUID) []byte {
	return newMessage(MessageTypePlayerLeft, map[string]any{
		"player_id": playerID.String(),
	})
}

func NewHostChangedMessage(playerID uuid.UUID) []byte {
	return newMessage(MesssageTypeHostChanged, map[string]any{
		"player_id": playerID.String(),
	})
}

func NewErrorMessage(message string) []byte {
	return newMessage(MessageTypeErrorMessage, map[string]any{
		"message": message,
	})
}

func NewChatReceivedMessage(playerID uuid.UUID, name, text string) []byte {
	return newMessage(MessageTypeChatReceived, map[string]any{
		"player_id": playerID.String(),
		"name":      name,
		"text":      text,
	})
}

type RoomStatePlayer struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Connected bool   `json:"connected"`
}

// NewRoomStateMessage builds the room_state payload. `password` must only be
// populated when the recipient is the host; pass "" otherwise.
func NewRoomStateMessage(roomID string, hostID uuid.UUID, password string, players []RoomStatePlayer, settings RoomSettings) []byte {
	return newMessage(MessageTypeRoomState, map[string]any{
		"room_id":  roomID,
		"host_id":  hostID.String(),
		"password": password,
		"players":  players,
		"settings": settings,
	})
}
