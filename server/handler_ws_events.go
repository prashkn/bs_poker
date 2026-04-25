package main

import (
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/prashkn/bs-poker/server/game"
	"github.com/prashkn/bs-poker/server/service"
)

// eventHandler processes a single client → server ws event.
type eventHandler func(player *game.Player, room *game.Room, payload json.RawMessage, registry service.RoomRegistryService)

// eventHandlers maps an incoming event type to its handler
var eventHandlers = map[game.MessageEvent]eventHandler{
	game.MessageTypeChat:       handleChatEvent,
	game.MessageTypeStartGame:  handleStartGameEvent,
	game.MessageTypeClaim:      handleClaimEvent,
	game.MessageTypeCallBS:     handleCallBSEvent,
	game.MessageTypeKickPlayer: handleKickPlayerEvent,
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
	turnDeadlineMs := time.Now().Add(room.Settings.TimePerTurn).UnixMilli()

	cardCounts := make(map[uuid.UUID]int, len(room.Players))
	hands := make(map[uuid.UUID][]game.Card, len(room.Players))
	for _, p := range room.Players {
		cardCounts[p.ID] = p.CardCount
		hands[p.ID] = append([]game.Card(nil), p.Hand...)
	}
	room.Mu.Unlock()

	for _, p := range room.Players {
		sendToPlayer(p, game.NewGameStartedMessage(hands[p.ID], currentTurn, round, turnOrder, cardCounts, turnDeadlineMs))
	}
}

type claimPayload struct {
	MadeHand game.MadeHand `json:"made_hand"`
}

func handleClaimEvent(player *game.Player, room *game.Room, payload json.RawMessage, _ service.RoomRegistryService) {
	var p claimPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		log.Printf("invalid claim payload from player %s: %v", player.ID, err)
		sendToPlayer(player, game.NewErrorMessage("invalid claim payload"))
		return
	}

	room.Mu.Lock()
	if err := service.MakeClaim(room, player.ID, p.MadeHand); err != nil {
		room.Mu.Unlock()
		sendToPlayer(player, game.NewErrorMessage(err.Error()))
		return
	}
	turnMsg := buildTurnMessage(room)
	room.Mu.Unlock()

	broadcastToRoom(room, game.NewClaimMadeMessage(player.ID, p.MadeHand), uuid.Nil)
	broadcastToRoom(room, turnMsg, uuid.Nil)
}

func handleCallBSEvent(player *game.Player, room *game.Room, _ json.RawMessage, _ service.RoomRegistryService) {
	room.Mu.Lock()
	result, err := service.CallBS(room, player.ID)
	if err != nil {
		room.Mu.Unlock()
		sendToPlayer(player, game.NewErrorMessage(err.Error()))
		return
	}

	// Snapshot next-round state under the lock so per-player round_started
	// sends can happen after release. Hands are only valid when the game
	// didn't end this call.
	var round int
	var hands map[uuid.UUID][]game.Card
	var turnMsg []byte
	if !result.GameOver {
		round = room.Session.Round
		hands = make(map[uuid.UUID][]game.Card, len(room.Players))
		for _, p := range room.Players {
			if p.IsAlive {
				hands[p.ID] = append([]game.Card(nil), p.Hand...)
			}
		}
		turnMsg = buildTurnMessage(room)
	}
	room.Mu.Unlock()

	broadcastToRoom(room, game.NewBSCalledMessage(result.Caller, result.Claimer), uuid.Nil)
	broadcastToRoom(room, game.NewBSResultMessage(result.Caller, result.Claimer, result.LoserID, result.ClaimValid, result.AllHands), uuid.Nil)
	if result.Eliminated {
		broadcastToRoom(room, game.NewPlayerEliminatedMessage(result.LoserID), uuid.Nil)
	}
	if result.GameOver {
		broadcastToRoom(room, game.NewGameOverMessage(result.WinnerID), uuid.Nil)
		return
	}
	for _, p := range room.Players {
		if hand, ok := hands[p.ID]; ok {
			sendToPlayer(p, game.NewRoundStartedMessage(round, hand))
		}
	}
	broadcastToRoom(room, turnMsg, uuid.Nil)
}

// buildTurnMessage snapshots the current session's next turn player and a
// fresh deadline. Caller must hold room.Mu so the snapshot is consistent.
func buildTurnMessage(room *game.Room) []byte {
	playerID := room.Session.TurnOrder[room.Session.CurrentTurn]
	deadlineMs := time.Now().Add(room.Settings.TimePerTurn).UnixMilli()
	return game.NewTurnMessage(playerID, deadlineMs)
}

type kickPlayerPayload struct {
	PlayerID uuid.UUID `json:"player_id"`
}

func handleKickPlayerEvent(player *game.Player, room *game.Room, payload json.RawMessage, registry service.RoomRegistryService) {
	var p kickPlayerPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		log.Printf("invalid kick_player payload from player %s: %v", player.ID, err)
		sendToPlayer(player, game.NewErrorMessage("invalid kick payload"))
		return
	}
	if player.ID != room.HostID {
		sendToPlayer(player, game.NewErrorMessage("only the host can kick players"))
		return
	}
	if p.PlayerID == player.ID {
		sendToPlayer(player, game.NewErrorMessage("cannot kick yourself"))
		return
	}

	room.Mu.Lock()
	target, ok := room.Players[p.PlayerID]
	if !ok {
		room.Mu.Unlock()
		sendToPlayer(player, game.NewErrorMessage("player not in room"))
		return
	}
	room.KickedIDs[p.PlayerID] = struct{}{}

	var forfeit service.ForfeitResult
	var turnMsg []byte
	if room.Session != nil {
		forfeit = service.ForfeitPlayer(room, p.PlayerID)
		if forfeit.TurnAdvanced && !forfeit.GameOver {
			turnMsg = buildTurnMessage(room)
		}
	}
	room.Mu.Unlock()

	// Notify the kicked player and tear down their socket. Snapshot the conn
	// under their lock so it can't get clobbered by a connection swap.
	target.Mu.Lock()
	targetConn := target.Conn
	target.Mu.Unlock()
	if targetConn != nil {
		sendToPlayer(target, game.NewKickedMessage())
		// Close after a short delay so the writePump has time to flush
		// `kicked` to the wire before we tear down.
		go func(c *websocket.Conn) {
			time.Sleep(100 * time.Millisecond)
			c.Close()
		}(targetConn)
	}

	hostChanged, err := registry.RemovePlayerFromRoom(room.ID, p.PlayerID)
	if err != nil {
		log.Printf("kick: RemovePlayerFromRoom failed for %s in %s: %v", p.PlayerID, room.ID, err)
	}

	broadcastToRoom(room, game.NewPlayerKickedMessage(p.PlayerID), uuid.Nil)
	if hostChanged {
		broadcastToRoom(room, game.NewHostChangedMessage(room.HostID), uuid.Nil)
	}
	if forfeit.GameOver {
		broadcastToRoom(room, game.NewGameOverMessage(forfeit.WinnerID), uuid.Nil)
	} else if turnMsg != nil {
		broadcastToRoom(room, turnMsg, uuid.Nil)
	}
}
