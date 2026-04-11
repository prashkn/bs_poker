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
	paramRoomID   = "room_id"
	paramPlayerID = "player_id"
)

func handleWebSocket(registry service.RoomRegistryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		roomID := r.PathValue(paramRoomID)
		playerIDStr := r.URL.Query().Get(paramPlayerID)

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
			http.Error(w, "room not found", http.StatusNotFound)
			return
		}

		player, err := registry.GetPlayerInRoom(roomID, playerID)
		if playerIDStr != "" && err != nil {
			http.Error(w, "player not found in room", http.StatusNotFound)
			return
		}

		if room.Session != nil {
			http.Error(w, "cannot join room while game is in progress", http.StatusConflict)
			return
		}

		// Tear down old connection before upgrading
		close(player.Done)
		if player.Conn != nil {
			player.Conn.Close()
		}
		player.SendCh = make(chan []byte, 256)
		player.Done = make(chan struct{})

		// Upgrade to WebSocket
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("websocket upgrade failed: %v", err)
			return
		}

		player.Conn = conn

		// Send room_state to the connecting player
		sendToPlayer(player, buildRoomState(room))

		// Broadcast to other players
		broadcastToRoom(room, game.NewPlayerJoinedMessage(player.ID, player.Name), player.ID)

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
	// During a game, keep the player in the room but mark them as disconnected
	if room.Session != nil {
		player.Conn = nil
		broadcastToRoom(room, game.NewPlayerLeftMessage(player.ID), player.ID)
		log.Printf("player %s disconnected from room %s (game in progress)", player.ID, room.ID)
		return
	}

	// In lobby, fully remove the player
	hostChanged, err := registry.RemovePlayerFromRoom(room.ID, player.ID)
	if err != nil {
		log.Printf("failed to remove player %s from room %s: %v", player.ID, room.ID, err)
		return
	}

	broadcastToRoom(room, game.NewPlayerLeftMessage(player.ID), uuid.Nil)

	if hostChanged {
		broadcastToRoom(room, game.NewHostChangedMessage(room.HostID), uuid.Nil)
	}

	log.Printf("player %s left room %s (%d remaining)", player.ID, room.ID, len(room.Players))
}

// buildRoomState creates the room_state message sent to a player on connect.
func buildRoomState(room *game.Room) []byte {
	players := make([]game.RoomStatePlayer, 0, len(room.Players))
	for _, p := range room.Players {
		players = append(players, game.RoomStatePlayer{
			ID:        p.ID.String(),
			Name:      p.Name,
			Connected: p.Conn != nil,
		})
	}

	return game.NewRoomStateMessage(room.ID, room.HostID, players, room.Settings)
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
