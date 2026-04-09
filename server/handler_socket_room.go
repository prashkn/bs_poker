package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/prashkn/bs-poker/server/game"
	"github.com/prashkn/bs-poker/server/service"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // TODO: restrict in production
	},
}

func handlePlayerDisconnect(player *game.Player, room *game.Room, registry service.RoomRegistryService) {
	playerID := player.ID
	wasHost := room.HostID == playerID

	// Build broadcast messages before removing, so we don't race on room.Players
	leftMsg, _ := game.NewMessage(game.MessageTypePlayerLeft, map[string]any{
		"player_id": playerID.String(),
	})

	// Broadcast to remaining players (the departing player is still in the list but excluded)
	broadcastToRoom(room, leftMsg, playerID)

	// Now remove the player
	err := registry.RemovePlayerFromRoom(room.ID, playerID)
	if err != nil {
		log.Printf("failed to remove player %s from room %s: %v", playerID, room.ID, err)
		return
	}

	// If the departing player was the host, notify remaining players of the new host
	if wasHost && len(room.Players) > 0 {
		if msg, err := game.NewMessage(game.MesssageTypeHostChanged, map[string]any{
			"player_id": room.HostID.String(),
		}); err == nil {
			broadcastToRoom(room, msg, uuid.Nil)
		}
	}

	log.Printf("player %s left room %s (%d players remaining)", playerID, room.ID, len(room.Players))
}

func handleWebSocket(registry service.RoomRegistryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		roomID := r.PathValue("roomID")
		playerIDStr := r.URL.Query().Get("player_id")
		playerName := r.URL.Query().Get("player_name")
		password := r.URL.Query().Get("password")

		room, err := registry.GetRoom(roomID)
		if err != nil {
			http.Error(w, "room not found", http.StatusNotFound)
			return
		}

		var player *game.Player

		if playerIDStr != "" {
			// Reconnecting player
			playerID, err := uuid.Parse(playerIDStr)
			if err != nil {
				http.Error(w, "invalid player_id", http.StatusBadRequest)
				return
			}
			player, err = registry.GetPlayerInRoom(roomID, playerID)
			if err != nil {
				http.Error(w, "player not found in room", http.StatusNotFound)
				return
			}
		} else {
			// New player joining
			if playerName == "" {
				http.Error(w, "player_name is required", http.StatusBadRequest)
				return
			}
			if password == "" {
				http.Error(w, "password is required", http.StatusBadRequest)
				return
			}
			if room.Password != password {
				http.Error(w, "invalid password", http.StatusUnauthorized)
				return
			}
			if room.Session != nil {
				http.Error(w, "cannot join room while game is in progress", http.StatusConflict)
				return
			}

			player = game.NewPlayer(playerName)
			if err := registry.AddPlayerToRoom(room.ID, player); err != nil {
				if err == service.ErrPlayerNameTaken {
					http.Error(w, "player name already taken in this room", http.StatusConflict)
					return
				}
				http.Error(w, "failed to join room", http.StatusInternalServerError)
				return
			}
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("websocket upgrade failed: %v", err)
			return
		}
		player.Conn = conn

		// Send room_state to the connecting player
		if msg, err := buildRoomState(room); err == nil {
			player.SendCh <- msg
		}

		// Broadcast player_joined to other players
		if msg, err := game.NewMessage(game.MessageTypePlayerJoined, map[string]any{
			"player_id": player.ID.String(),
			"name":      player.Name,
		}); err == nil {
			broadcastToRoom(room, msg, player.ID)
		}

		// Start read/write pumps
		go writePump(player)
		go readPump(player, room, registry)
	}
}

// buildRoomState creates the room_state message sent to a player on connect.
func buildRoomState(room *game.Room) ([]byte, error) {
	players := make([]map[string]any, 0, len(room.Players))
	for _, p := range room.Players {
		players = append(players, map[string]any{
			"id":   p.ID.String(),
			"name": p.Name,
		})
	}

	return game.NewMessage(game.MessageTypeRoomState, map[string]any{
		"room_id":  room.ID,
		"host_id":  room.HostID.String(),
		"players":  players,
		"settings": room.Settings,
	})
}

// broadcastToRoom sends a message to all players in the room except the excluded player.
func broadcastToRoom(room *game.Room, msg []byte, excludePlayerID uuid.UUID) {
	log.Printf("broadcasting to room %s (%d players), excluding %s: %s", room.ID, len(room.Players), excludePlayerID, string(msg))
	for _, p := range room.Players {
		if p.ID == excludePlayerID || p.Conn == nil {
			log.Printf("skipping player %s (excluded=%v, conn_nil=%v)", p.ID, p.ID == excludePlayerID, p.Conn == nil)
			continue
		}
		select {
		case p.SendCh <- msg:
			log.Printf("sent message to player %s", p.ID)
		default:
			log.Printf("send channel full for player %s, dropping message", p.ID)
		}
	}
}

// writePump pumps messages from the player's SendCh to the WebSocket connection.
func writePump(player *game.Player) {
	defer player.Conn.Close()

	for msg := range player.SendCh {
		if err := player.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			log.Printf("write error for player %s: %v", player.ID, err)
			return
		}
	}
}

// readPump reads messages from the WebSocket connection and dispatches them to handlers.
func readPump(player *game.Player, room *game.Room, registry service.RoomRegistryService) {
	defer func() {
		handlePlayerDisconnect(player, room, registry)
		player.Conn.Close()
		close(player.SendCh)
	}()

	for {
		_, msg, err := player.Conn.ReadMessage()
		if err != nil {
			log.Printf("read error for player %s: %v", player.ID, err)
			return
		}

		log.Printf("received from player %s: %s", player.ID, string(msg))

		message, err := game.ParseMessage(msg)
		if err != nil {
			log.Printf("failed to parse message from player %s: %v", player.ID, err)
			continue
		}

		switch message.Event {
		case game.MessageTypeChat:
			handleChat(player, room, message.Payload)
		case game.MessageTypeStartGame:
			handleStartGame(player, room)
		case game.MessageTypeClaim:
			handleClaim(player, room, message.Payload)
		case game.MessageTypeCallBS:
			handleCallBS(player, room)
		case game.MessageTypeKickPlayer:
			handleKick(player, room, registry, message.Payload)
		case game.MessageTypeUpdateSettings:
			handleUpdateSettings(player, room, message.Payload)
		default:
			log.Printf("unhandled event %q from player %s", message.Event, player.ID)
		}
	}
}

func handleChat(player *game.Player, room *game.Room, payload json.RawMessage) {
	var p game.ChatPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		log.Printf("invalid chat payload from player %s: %v", player.ID, err)
		return
	}

	toBroadcast, _ := game.NewMessage(game.MessageTypeChatReceived, map[string]any{
		"name": player.Name,
		"text": p.Text,
	})
	broadcastToRoom(room, toBroadcast, player.ID)
}

// sendError sends an error_message event to a single player.
func sendError(player *game.Player, text string) {
	if msg, err := game.NewMessage(game.MessageTypeErrorMessage, map[string]any{
		"message": text,
	}); err == nil {
		select {
		case player.SendCh <- msg:
		default:
		}
	}
}

// sendToPlayer sends a message to a single player.
func sendToPlayer(player *game.Player, msg []byte) {
	select {
	case player.SendCh <- msg:
	default:
		log.Printf("send channel full for player %s, dropping message", player.ID)
	}
}

// broadcastTurn sends the current turn info to all players.
func broadcastTurn(room *game.Room) {
	g := room.Session
	payload := map[string]any{
		"player_id": g.TurnOrder[g.CurrentTurn].String(),
	}
	if g.CurrentClaim != nil {
		payload["current_claim"] = g.CurrentClaim
	}
	if msg, err := game.NewMessage(game.MessageTypeTurn, payload); err == nil {
		broadcastToRoom(room, msg, uuid.Nil)
	}
}

func handleStartGame(player *game.Player, room *game.Room) {
	room.Mu.Lock()
	defer room.Mu.Unlock()

	if err := service.StartGame(room, player.ID); err != nil {
		sendError(player, err.Error())
		return
	}

	// Send game_started to each player individually (each gets their own hand)
	for _, p := range room.Players {
		if p.Conn == nil {
			continue
		}
		if msg, err := game.NewMessage(game.MessageTypeGameStarted, map[string]any{
			"hand": p.Hand,
		}); err == nil {
			sendToPlayer(p, msg)
		}
	}

	// Broadcast turn info
	broadcastTurn(room)
}

func handleClaim(player *game.Player, room *game.Room, payload json.RawMessage) {
	var p game.ClaimPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		log.Printf("invalid claim payload from player %s: %v", player.ID, err)
		return
	}

	room.Mu.Lock()
	defer room.Mu.Unlock()

	if err := service.MakeClaim(room, player.ID, p.MadeHand); err != nil {
		sendError(player, err.Error())
		return
	}

	// Broadcast claim_made
	if msg, err := game.NewMessage(game.MessageTypeClaimMade, map[string]any{
		"player_id": player.ID.String(),
		"made_hand": room.Session.CurrentClaim.MadeHand,
	}); err == nil {
		broadcastToRoom(room, msg, uuid.Nil)
	}

	// Broadcast turn info
	broadcastTurn(room)
}

func handleCallBS(player *game.Player, room *game.Room) {
	room.Mu.Lock()
	defer room.Mu.Unlock()

	result, err := service.CallBS(room, player.ID)
	if err != nil {
		sendError(player, err.Error())
		return
	}

	// Broadcast bs_result with all hands revealed
	if msg, err := game.NewMessage(game.MessageTypeBSResult, map[string]any{
		"caller_id":   result.Caller.String(),
		"claimer_id":  result.Claimer.String(),
		"all_hands":   result.AllHands,
		"claim_valid": result.ClaimValid,
		"loser_id":    result.LoserID.String(),
		"eliminated":  result.Eliminated,
	}); err == nil {
		broadcastToRoom(room, msg, uuid.Nil)
	}

	// If eliminated, broadcast player_eliminated
	if result.Eliminated {
		if msg, err := game.NewMessage(game.MessageTypePlayerEliminated, map[string]any{
			"player_id": result.LoserID.String(),
		}); err == nil {
			broadcastToRoom(room, msg, uuid.Nil)
		}
	}

	// Game over or new round
	if result.GameOver {
		if msg, err := game.NewMessage(game.MessageTypeGameOver, map[string]any{
			"winner_id": result.WinnerID.String(),
		}); err == nil {
			broadcastToRoom(room, msg, uuid.Nil)
		}
		return
	}

	// New round started — send each player their new hand
	for _, p := range room.Players {
		if !p.IsAlive || p.Conn == nil {
			continue
		}
		if msg, err := game.NewMessage(game.MessageTypeRoundStarted, map[string]any{
			"hand":  p.Hand,
			"round": room.Session.Round,
		}); err == nil {
			sendToPlayer(p, msg)
		}
	}

	broadcastTurn(room)
}

func handleKick(player *game.Player, room *game.Room, registry service.RoomRegistryService, payload json.RawMessage) {
	var p game.KickPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		log.Printf("invalid kick payload from player %s: %v", player.ID, err)
		return
	}

	// Only the host can kick
	if room.HostID != player.ID {
		log.Printf("player %s tried to kick but is not host in room %s", player.ID, room.ID)
		return
	}

	targetID, err := uuid.Parse(p.PlayerID)
	if err != nil {
		log.Printf("invalid target player_id %q from player %s", p.PlayerID, player.ID)
		return
	}
	if targetID == player.ID {
		log.Printf("player %s tried to kick themselves in room %s", player.ID, room.ID)
		return
	}

	target, err := registry.GetPlayerInRoom(room.ID, targetID)
	if err != nil {
		log.Printf("kick target %s not found in room %s", targetID, room.ID)
		return
	}

	// Broadcast player_left to remaining players
	leftMsg, _ := game.NewMessage(game.MessageTypePlayerLeft, map[string]any{
		"player_id": targetID.String(),
	})
	broadcastToRoom(room, leftMsg, targetID)

	// Remove from room
	if err := registry.RemovePlayerFromRoom(room.ID, targetID); err != nil {
		log.Printf("failed to remove kicked player %s from room %s: %v", targetID, room.ID, err)
		return
	}

	// Close the kicked player's connection — their readPump will clean up
	if target.Conn != nil {
		target.Conn.Close()
	}

	log.Printf("player %s kicked %s from room %s", player.ID, targetID, room.ID)
}

func handleUpdateSettings(player *game.Player, room *game.Room, payload json.RawMessage) {
	var p game.UpdateSettingsPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		log.Printf("invalid update_settings payload from player %s: %v", player.ID, err)
		return
	}

	// TODO: verify player is host, update room settings, broadcast settings_updated
	log.Printf("player %s requested settings update in room %s", player.ID, room.ID)
}
