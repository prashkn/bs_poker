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
	leftMsg, _ := json.Marshal(map[string]interface{}{
		"type":      string(models.MessageTypePlayerLeft),
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
		hostChanged := map[string]interface{}{
			"type":      string(models.MesssageTypeHostChanged),
			"player_id": room.HostID.String(),
		}
		if msg, err := json.Marshal(hostChanged); err == nil {
			broadcastToRoom(room, msg, uuid.Nil)
		}
	}

	log.Printf("player %s left room %s (%d players remaining)", playerID, room.ID, len(room.Players))
}

func handleWebSocket(registry service.RoomRegistryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		roomID := r.PathValue("roomID")
		playerIDStr := r.URL.Query().Get("player_id")

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
		roomState := buildRoomState(room)
		if msg, err := json.Marshal(roomState); err == nil {
			player.SendCh <- msg
		}

		// Broadcast player_joined to other players
		joined := map[string]interface{}{
			"type":      string(models.MessageTypePlayerJoined),
			"player_id": player.ID.String(),
			"name":      player.Name,
		}
		if msg, err := json.Marshal(joined); err == nil {
			broadcastToRoom(room, msg, player.ID)
		}

		// Start read/write pumps
		go writePump(player)
		go readPump(player, room, registry)
	}
}

// buildRoomState creates the room_state payload sent to a player on connect.
func buildRoomState(room *models.Room) map[string]interface{} {
	players := make([]map[string]interface{}, 0, len(room.Players))
	for _, p := range room.Players {
		players = append(players, map[string]interface{}{
			"id":   p.ID.String(),
			"name": p.Name,
		})
	}

	return map[string]interface{}{
		"type":     string(models.MessageTypeRoomState),
		"room_id":  room.ID,
		"host_id":  room.HostID.String(),
		"players":  players,
		"settings": room.Settings,
	}
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

// readPump reads messages from the WebSocket connection and handles them.
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
		// TODO: parse message and handle game events (claim, call_bs, chat, etc.)
	}
}
