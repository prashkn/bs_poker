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

// Websocket API Contracts:
const (
	paramRoomID   = "roomID"
	paramPlayerID = "player_id"
)

func handleWebSocket(registry service.RoomRegistryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("[ws] PANIC in handler: %v", rec)
			}
		}()

		roomID := r.PathValue(paramRoomID)
		playerIDStr := r.URL.Query().Get(paramPlayerID)
		log.Printf("[ws] connect attempt room=%s player=%s", roomID, playerIDStr)

		if roomID == "" {
			http.Error(w, "room_id is required in path", http.StatusBadRequest)
			return
		}
		if playerIDStr == "" {
			http.Error(w, "player_id is required in query", http.StatusBadRequest)
			return
		}
		playerID, err := uuid.Parse(playerIDStr)
		if playerIDStr != "" && err != nil {
			http.Error(w, "invalid player_id", http.StatusBadRequest)
			return
		}

		room, err := registry.GetRoom(roomID)
		if err != nil {
			log.Printf("[ws] reject room=%s: room not found", roomID)
			http.Error(w, "room not found", http.StatusNotFound)
			return
		}

		player, err := registry.GetPlayerInRoom(roomID, playerID)
		if playerIDStr != "" && err != nil {
			log.Printf("[ws] reject room=%s player=%s: player not found", roomID, playerIDStr)
			http.Error(w, "player not found in room", http.StatusNotFound)
			return
		}

		if room.Session != nil {
			log.Printf("[ws] reject room=%s player=%s: game in progress", roomID, playerIDStr)
			http.Error(w, "cannot join room while game is in progress", http.StatusConflict)
			return
		}
		log.Printf("[ws] accepting room=%s player=%s", roomID, playerIDStr)

		// Snapshot any prior connection, then close it to nudge the old readPump to exit.
		// We don't touch player.Done here — each pump owns the Done it was started with,
		// so the old pump will close its own Done in its defer.
		player.Mu.Lock()
		oldConn := player.Conn
		player.Mu.Unlock()
		if oldConn != nil {
			oldConn.Close()
		}

		// Upgrade to WebSocket
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("[ws] upgrade failed room=%s player=%s: %v", roomID, playerIDStr, err)
			return
		}
		log.Printf("[ws] upgraded room=%s player=%s", roomID, playerIDStr)

		// Install fresh per-connection state. Pumps receive these as params
		// and don't re-read player.SendCh/Done, so old pumps can't interfere.
		sendCh := make(chan []byte, 256)
		done := make(chan struct{})
		player.Mu.Lock()
		player.Conn = conn
		player.SendCh = sendCh
		player.Done = done
		player.Mu.Unlock()

		// Send room_state to the connecting player
		sendToPlayer(player, buildRoomState(room, player.ID))

		// Broadcast to other players
		broadcastToRoom(room, game.NewPlayerJoinedMessage(player.ID, player.Name), player.ID)

		// Start write goroutine, then run read loop blocking on this goroutine
		go writePump(conn, sendCh, done)
		readPump(player, conn, done, room, registry)
	}
}

// writePump drains the connection's sendCh and writes to the WebSocket.
// Pumps own their conn/channels as params so a newer connection swapping in
// on player.* can't corrupt this pump's state.
func writePump(conn *websocket.Conn, sendCh chan []byte, done chan struct{}) {
	for {
		select {
		case msg, ok := <-sendCh:
			if !ok {
				return
			}
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				log.Printf("write error: %v", err)
				return
			}
		case <-done:
			return
		}
	}
}

// readPump reads messages from the WebSocket and dispatches them. Runs on the
// handler goroutine (blocking). Owns cleanup for THIS connection on exit.
func readPump(player *game.Player, conn *websocket.Conn, done chan struct{}, room *game.Room, registry service.RoomRegistryService) {
	defer func() {
		close(done)
		conn.Close()
		handlePlayerDisconnect(player, conn, room, registry)
	}()

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			log.Printf("read error for player %s: %v", player.ID, err)
			return
		}

		message, err := game.ParseMessage(msg)
		if err != nil {
			log.Printf("invalid message from player %s: %v", player.ID, err)
			continue
		}

		dispatchEvent(message, player, room, registry)
	}
}

// handlePlayerDisconnect nils player.Conn only if it still points at the
// connection that is shutting down. This prevents a stale defer from
// clobbering a newer connection that has already swapped in.
func handlePlayerDisconnect(player *game.Player, conn *websocket.Conn, room *game.Room, _ service.RoomRegistryService) {
	player.Mu.Lock()
	replaced := player.Conn != conn
	if !replaced {
		player.Conn = nil
	}
	player.Mu.Unlock()

	if replaced {
		// Newer connection already active; don't broadcast a spurious "left".
		log.Printf("player %s old connection closed (already replaced)", player.ID)
		return
	}

	broadcastToRoom(room, game.NewPlayerLeftMessage(player.ID), player.ID)
	log.Printf("player %s disconnected from room %s", player.ID, room.ID)
}

// buildRoomState creates the room_state message sent to a player on connect.
// The password is only included when receiverID is the current host.
func buildRoomState(room *game.Room, receiverID uuid.UUID) []byte {
	players := make([]game.RoomStatePlayer, 0, len(room.Players))
	for _, p := range room.Players {
		players = append(players, game.RoomStatePlayer{
			ID:        p.ID.String(),
			Name:      p.Name,
			Connected: p.Conn != nil,
		})
	}

	password := ""
	if receiverID == room.HostID {
		password = room.Password
	}

	return game.NewRoomStateMessage(room.ID, room.HostID, password, players, room.Settings)
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
