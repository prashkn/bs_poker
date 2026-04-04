package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/prashkn/bs-poker/server/models"
	"github.com/prashkn/bs-poker/server/service"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // TODO: restrict in production
	},
}

func handlePlayerDisconnect(player *models.Player, room *models.Room, registry service.RoomRegistryService) {
	playerID := player.ID
	wasHost := room.HostID == playerID

	// Build broadcast messages before removing, so we don't race on room.Players
	leftMsg, _ := models.NewMessage(models.MessageTypePlayerLeft, map[string]any{
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
		if msg, err := models.NewMessage(models.MesssageTypeHostChanged, map[string]any{
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

		// Validation
		if playerIDStr == "" {
			http.Error(w, "player_id is required", http.StatusBadRequest)
			return
		}
		playerID, err := uuid.Parse(playerIDStr)
		if err != nil {
			http.Error(w, "invalid player_id", http.StatusBadRequest)
			return
		}

		room, err := registry.GetRoom(roomID)
		if err != nil {
			http.Error(w, "room not found", http.StatusNotFound)
			return
		}
		player, err := registry.GetPlayerInRoom(roomID, playerID)
		if err != nil {
			http.Error(w, "player not found in room", http.StatusNotFound)
			return
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
		if msg, err := models.NewMessage(models.MessageTypePlayerJoined, map[string]any{
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
func buildRoomState(room *models.Room) ([]byte, error) {
	players := make([]map[string]any, 0, len(room.Players))
	for _, p := range room.Players {
		players = append(players, map[string]any{
			"id":   p.ID.String(),
			"name": p.Name,
		})
	}

	return models.NewMessage(models.MessageTypeRoomState, map[string]any{
		"room_id":  room.ID,
		"host_id":  room.HostID.String(),
		"players":  players,
		"settings": room.Settings,
	})
}

// broadcastToRoom sends a message to all players in the room except the excluded player.
func broadcastToRoom(room *models.Room, msg []byte, excludePlayerID uuid.UUID) {
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
func writePump(player *models.Player) {
	defer player.Conn.Close()

	for msg := range player.SendCh {
		if err := player.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			log.Printf("write error for player %s: %v", player.ID, err)
			return
		}
	}
}

// readPump reads messages from the WebSocket connection and dispatches them to handlers.
func readPump(player *models.Player, room *models.Room, registry service.RoomRegistryService) {
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

		message, err := models.ParseMessage(msg)
		if err != nil {
			log.Printf("failed to parse message from player %s: %v", player.ID, err)
			continue
		}

		switch message.Event {
		case models.MessageTypeChat:
			handleChat(player, room, message.Payload)
		case models.MessageTypeStartGame:
			handleStartGame(player, room)
		case models.MessageTypeClaim:
			handleClaim(player, room, message.Payload)
		case models.MessageTypeCallBS:
			handleCallBS(player, room)
		case models.MessageTypeKickPlayer:
			handleKick(player, room, registry, message.Payload)
		case models.MessageTypeUpdateSettings:
			handleUpdateSettings(player, room, message.Payload)
		default:
			log.Printf("unhandled event %q from player %s", message.Event, player.ID)
		}
	}
}

func handleChat(player *models.Player, room *models.Room, payload json.RawMessage) {
	var p models.ChatPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		log.Printf("invalid chat payload from player %s: %v", player.ID, err)
		return
	}

	toBroadcast, _ := models.NewMessage(models.MessageTypeChatReceived, map[string]any{
		"name": player.Name,
		"text": p.Text,
	})
	broadcastToRoom(room, toBroadcast, player.ID)
}

func handleStartGame(player *models.Player, room *models.Room) {
	// TODO: verify player is host, room has enough players, no game in progress
	// TODO: initialize game state, deal cards, broadcast game_started
	log.Printf("player %s requested start_game in room %s", player.ID, room.ID)
}

func handleClaim(player *models.Player, room *models.Room, payload json.RawMessage) {
	var p models.ClaimPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		log.Printf("invalid claim payload from player %s: %v", player.ID, err)
		return
	}

	// TODO: validate it's this player's turn, claim is higher than current, broadcast claim_made
	log.Printf("player %s claimed %s in room %s", player.ID, p.Hand, room.ID)
}

func handleCallBS(player *models.Player, room *models.Room) {
	// TODO: validate it's this player's turn and there's an active claim
	// TODO: resolve BS, broadcast bs_called + bs_result, handle elimination/round logic
	log.Printf("player %s called BS in room %s", player.ID, room.ID)
}

func handleKick(player *models.Player, room *models.Room, registry service.RoomRegistryService, payload json.RawMessage) {
	var p models.KickPayload
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
	leftMsg, _ := models.NewMessage(models.MessageTypePlayerLeft, map[string]any{
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

func handleUpdateSettings(player *models.Player, room *models.Room, payload json.RawMessage) {
	var p models.UpdateSettingsPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		log.Printf("invalid update_settings payload from player %s: %v", player.ID, err)
		return
	}

	// TODO: verify player is host, update room settings, broadcast settings_updated
	log.Printf("player %s requested settings update in room %s", player.ID, room.ID)
}
