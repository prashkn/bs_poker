package main

import (
	"encoding/json"
	"log"
	"strings"

	"github.com/prashkn/bs-poker/server/game"
	"github.com/prashkn/bs-poker/server/service"
)

// eventHandler processes a single client → server ws event.
type eventHandler func(player *game.Player, room *game.Room, payload json.RawMessage, registry service.RoomRegistryService)

// eventHandlers maps an incoming event type to its handler. Register new
// handlers here as game actions are implemented.
var eventHandlers = map[game.MessageEvent]eventHandler{
	game.MessageTypeChat: handleChatEvent,
	// TODO: start_game, claim, call_bs, kick_player, update_settings
}

// dispatchEvent routes a parsed ws message to its registered handler.
func dispatchEvent(msg *game.RawMessage, player *game.Player, room *game.Room, registry service.RoomRegistryService) {
	handler, ok := eventHandlers[msg.Event]
	if !ok {
		log.Printf("no handler for event %q from player %s", msg.Event, player.ID)
		return
	}
	handler(player, room, msg.Payload, registry)
}

type chatPayload struct {
	Text string `json:"text"`
}

func handleChatEvent(player *game.Player, room *game.Room, payload json.RawMessage, _ service.RoomRegistryService) {
	var p chatPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		log.Printf("invalid chat payload from player %s: %v", player.ID, err)
		return
	}
	text := strings.TrimSpace(p.Text)
	if text == "" {
		return
	}
	broadcastToRoom(room, game.NewChatReceivedMessage(player.ID, player.Name, text), player.ID)
}
