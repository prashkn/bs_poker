package main

import (
	"log"
	"net/http"
	"time"

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

		// Reject kicked player_ids with a clear 403 so the client can show
		// "you were kicked" instead of a generic not-found.
		room.Mu.Lock()
		_, kicked := room.KickedIDs[playerID]
		room.Mu.Unlock()
		if kicked {
			log.Printf("[ws] reject room=%s player=%s: kicked", roomID, playerIDStr)
			http.Error(w, "you have been kicked from this room", http.StatusForbidden)
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

		// Snapshot the previous connection and cancel any pending disconnect
		// cleanup — we're re-establishing the seat. AfterFunc.Stop() can
		// return false if the timer already fired; finalizeDisconnect
		// re-checks player.Conn and bails when a newer one is installed.
		player.Mu.Lock()
		oldConn := player.Conn
		if player.DisconnectTimer != nil {
			player.DisconnectTimer.Stop()
			player.DisconnectTimer = nil
		}
		player.Mu.Unlock()

		// Upgrade to WebSocket BEFORE closing oldConn so we can swap atomically.
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

		// Now that the new conn is installed, close the old one. Its readPump
		// will exit and `handlePlayerDisconnect` will see player.Conn != oldConn
		// and bail — no spurious forfeit/leave broadcast.
		if oldConn != nil {
			oldConn.Close()
		}

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

// disconnectGrace is how long we wait after a WebSocket close before
// forfeiting and removing the player. Absorbs React StrictMode dev
// double-mounts, page refreshes, and brief network blips.
const disconnectGrace = 10 * time.Second

// handlePlayerDisconnect schedules cleanup after a closed WebSocket. If the
// player reconnects within disconnectGrace the cleanup is cancelled. If they
// don't, finalizeDisconnect forfeits the session seat, removes them from the
// room, and broadcasts the follow-up events.
func handlePlayerDisconnect(player *game.Player, conn *websocket.Conn, room *game.Room, registry service.RoomRegistryService) {
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

	// Skip if already removed by the kick path.
	if _, err := registry.GetPlayerInRoom(room.ID, player.ID); err != nil {
		log.Printf("player %s already removed from room %s; skipping disconnect cleanup", player.ID, room.ID)
		return
	}

	player.Mu.Lock()
	if player.DisconnectTimer != nil {
		player.DisconnectTimer.Stop()
	}
	player.DisconnectTimer = time.AfterFunc(disconnectGrace, func() {
		finalizeDisconnect(player, room, registry)
	})
	player.Mu.Unlock()

	log.Printf("player %s disconnected from room %s; cleanup scheduled in %s", player.ID, room.ID, disconnectGrace)
}

// finalizeDisconnect runs after the grace period. It bails if the player has
// reconnected (player.Conn != nil) or has already been removed.
func finalizeDisconnect(player *game.Player, room *game.Room, registry service.RoomRegistryService) {
	player.Mu.Lock()
	reconnected := player.Conn != nil
	if !reconnected {
		player.DisconnectTimer = nil
	}
	player.Mu.Unlock()
	if reconnected {
		log.Printf("player %s reconnected within grace; skipping cleanup", player.ID)
		return
	}

	if _, err := registry.GetPlayerInRoom(room.ID, player.ID); err != nil {
		return
	}

	room.Mu.Lock()
	var forfeit service.ForfeitResult
	var turnMsg []byte
	if room.Session != nil {
		forfeit = service.ForfeitPlayer(room, player.ID)
		if forfeit.TurnAdvanced && !forfeit.GameOver {
			turnMsg = buildTurnMessage(room)
		}
	}
	room.Mu.Unlock()

	hostChanged, err := registry.RemovePlayerFromRoom(room.ID, player.ID)
	if err != nil {
		log.Printf("disconnect: RemovePlayerFromRoom failed for %s in %s: %v", player.ID, room.ID, err)
	}

	broadcastToRoom(room, game.NewPlayerLeftMessage(player.ID), uuid.Nil)
	if hostChanged {
		broadcastToRoom(room, game.NewHostChangedMessage(room.HostID), uuid.Nil)
	}
	if forfeit.GameOver {
		broadcastToRoom(room, game.NewGameOverMessage(forfeit.WinnerID), uuid.Nil)
	} else if turnMsg != nil {
		broadcastToRoom(room, turnMsg, uuid.Nil)
	}

	log.Printf("player %s removed from room %s after grace", player.ID, room.ID)
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
