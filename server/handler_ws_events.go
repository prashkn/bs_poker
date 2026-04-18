package main

import (
	"encoding/json"
	"log"
	"strings"

	"github.com/google/uuid"
	"github.com/prashkn/bs-poker/server/game"
	"github.com/prashkn/bs-poker/server/service"
)

// eventHandler processes a single client → server ws event.
type eventHandler func(player *game.Player, room *game.Room, payload json.RawMessage, registry service.RoomRegistryService)

// eventHandlers maps an incoming event type to its handler
var eventHandlers = map[game.MessageEvent]eventHandler{
	game.MessageTypeChat:      handleChatEvent,
	game.MessageTypeStartGame: handleStartGameEvent,
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

func handleStartGameEvent(player *game.Player, room *game.Room, _ json.RawMessage, _ service.RoomRegistryService) {
	room.Mu.Lock()
	if err := service.StartGame(room, player.ID); err != nil {
		room.Mu.Unlock()
		sendToPlayer(player, game.NewErrorMessage(err.Error()))
		return
	}

	// Snapshot shared session data and per-player hands before releasing the lock.
	session := room.Session
	round := session.Round
	turnOrder := append([]uuid.UUID(nil), session.TurnOrder...)
	currentTurn := session.TurnOrder[session.CurrentTurn]

	cardCounts := make(map[uuid.UUID]int, len(room.Players))
	hands := make(map[uuid.UUID][]game.Card, len(room.Players))
	for _, p := range room.Players {
		cardCounts[p.ID] = p.CardCount
		hands[p.ID] = append([]game.Card(nil), p.Hand...)
	}
	room.Mu.Unlock()

	for _, p := range room.Players {
		sendToPlayer(p, game.NewGameStartedMessage(hands[p.ID], currentTurn, round, turnOrder, cardCounts))
	}
}
