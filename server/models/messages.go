package models

import (
	"errors"
	"strings"
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
	MesssageTypeHostChanged     MessageEvent = "host_changed"
)

type Message struct {
	ID        uuid.UUID    `json:"id"`
	Event     MessageEvent `json:"message_event"`
	Content   string       `json:"content"`
	CreatedAt time.Time    `json:"created_at"`
}

func ParseMessage(s string) (*Message, error) {
	// messages formated as following {type}:{content}
	split := strings.SplitN(s, ":", 3)
	if len(split) < 2 {
		return nil, errors.New("invalid messsage format")
	}

	id, _ := uuid.NewUUID()
	created_at := time.Now()
	event := MessageEvent(split[0])
	content := split[1]

	message := &Message{
		ID:        id,
		Event:     event,
		Content:   content,
		CreatedAt: created_at,
	}

	return message, nil
}
