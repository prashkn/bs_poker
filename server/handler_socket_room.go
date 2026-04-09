package main

import (
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/prashkn/bs-poker/server/game"
	"github.com/prashkn/bs-poker/server/service"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// return r.Header.Get("Origin") == "thedomain.com"
		return true // TODO: restrict in production
	},
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
		isReconnect := false

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
			isReconnect = true

			// Tear down old connection before upgrading
			close(player.Done)
			if player.Conn != nil {
				player.Conn.Close()
			}
			player.SendCh = make(chan []byte, 256)
			player.Done = make(chan struct{})
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
		}

		// Upgrade first — if this fails, no player state to clean up (for new players)
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("websocket upgrade failed: %v", err)
			return
		}

		// For new players, create and add to room after successful upgrade
		if !isReconnect {
			player = game.NewPlayer(playerName)
			if err := registry.AddPlayerToRoom(room.ID, player); err != nil {
				log.Printf("failed to add player to room: %v", err)
				conn.Close()
				return
			}
		}

		player.Conn = conn

		// Send room_state to the connecting player
		if msg, err := buildRoomState(room); err == nil {
			sendToPlayer(player, msg)
		}

		// Broadcast player_joined to other players (only for new players)
		if !isReconnect {
			if msg, err := game.NewMessage(game.MessageTypePlayerJoined, map[string]any{
				"player_id": player.ID.String(),
				"name":      player.Name,
			}); err == nil {
				broadcastToRoom(room, msg, player.ID)
			}
		}

		// Start write goroutine, then run read loop blocking on this goroutine
		go writePump(player)
		readPump(player, room, registry)
	}
}

// writePump drains the player's SendCh and writes to the WebSocket connection.
// Stops when Done is closed.
func writePump(player *game.Player) {
	for {
		select {
		case msg, ok := <-player.SendCh:
			if !ok {
				return
			}
			if err := player.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				log.Printf("write error for player %s: %v", player.ID, err)
				return
			}
		case <-player.Done:
			return
		}
	}
}

// readPump reads messages from the WebSocket and dispatches them.
// Runs on the handler goroutine (blocking). Owns cleanup on exit.
func readPump(player *game.Player, room *game.Room, registry service.RoomRegistryService) {
	defer func() {
		close(player.Done)
		player.Conn.Close()
		handlePlayerDisconnect(player, room, registry)
	}()

	for {
		_, msg, err := player.Conn.ReadMessage()
		if err != nil {
			log.Printf("read error for player %s: %v", player.ID, err)
			return
		}

		message, err := game.ParseMessage(msg)
		if err != nil {
			log.Printf("invalid message from player %s: %v", player.ID, err)
			continue
		}

		// TODO: wire up game event handlers
		log.Printf("received event %q from player %s", message.Event, player.ID)
	}
}

func handlePlayerDisconnect(player *game.Player, room *game.Room, registry service.RoomRegistryService) {
	playerID := player.ID
	wasHost := room.HostID == playerID

	leftMsg, _ := game.NewMessage(game.MessageTypePlayerLeft, map[string]any{
		"player_id": playerID.String(),
	})
	broadcastToRoom(room, leftMsg, playerID)

	if err := registry.RemovePlayerFromRoom(room.ID, playerID); err != nil {
		log.Printf("failed to remove player %s from room %s: %v", playerID, room.ID, err)
		return
	}

	if wasHost && len(room.Players) > 0 {
		if msg, err := game.NewMessage(game.MesssageTypeHostChanged, map[string]any{
			"player_id": room.HostID.String(),
		}); err == nil {
			broadcastToRoom(room, msg, uuid.Nil)
		}
	}

	log.Printf("player %s left room %s (%d remaining)", playerID, room.ID, len(room.Players))
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
	for _, p := range room.Players {
		if p.ID == excludePlayerID || p.Conn == nil {
			continue
		}
		sendToPlayer(p, msg)
	}
}

// sendToPlayer sends a message to a single player (non-blocking).
func sendToPlayer(player *game.Player, msg []byte) {
	select {
	case player.SendCh <- msg:
	default:
		log.Printf("send channel full for player %s, dropping message", player.ID)
	}
}
