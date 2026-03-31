package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/prashkn/bs-poker/server/models"
)

type createRoomRequest struct {
	Password string `json:"password"`
	HostName string `json:"host_name"`
}

type createRoomResponse struct {
	RoomID string `json:"room_id"`
	HostID string `json:"host_id"`
}

// generateRoomID generates a random 8-character hexadecimal string.
func generateRoomID() string {
	b := make([]byte, 4)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func handleCreateRoom(registry *RoomRegistry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req createRoomRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Password == "" {
			http.Error(w, "password is required", http.StatusBadRequest)
			return
		}
		if req.HostName == "" {
			http.Error(w, "host_name is required", http.StatusBadRequest)
			return
		}

		roomID := generateRoomID()
		hostID := uuid.New()
		host := &models.Player{
			ID:      hostID,
			Name:    req.HostName,
			IsAlive: true,
		}
		room := &models.Room{
			ID:       roomID,
			Password: req.Password,
			HostID:   hostID,
			Players:  []*models.Player{host},
			Settings: models.RoomSettings{
				TimePerTurn:               30 * time.Second,
				MaxCardsBeforeElimination: 6,
			},
			CreatedAt: time.Now(),
		}
		host.Room = room
		registry.Set(roomID, room)
		log.Printf("room created: %s by host %s (%s)", roomID, req.HostName, hostID)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(createRoomResponse{RoomID: roomID, HostID: hostID.String()})
	}
}

type joinRoomRequest struct {
	RoomID   string `json:"room_id"`
	Password string `json:"password"`
	UserName string `json:"user_name"`
}

type joinRoomResponse struct {
	PlayerID string `json:"player_id"`
	RoomID   string `json:"room_id"`
}

func handleJoinRoom(registry *RoomRegistry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req joinRoomRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.RoomID == "" {
			http.Error(w, "room_id is required", http.StatusBadRequest)
			return
		}
		if req.Password == "" {
			http.Error(w, "password is required", http.StatusBadRequest)
			return
		}
		if req.UserName == "" {
			http.Error(w, "user_name is required", http.StatusBadRequest)
			return
		}

		room, ok := registry.Get(req.RoomID)
		if !ok {
			http.Error(w, "room not found", http.StatusNotFound)
			return
		}

		if room.Password != req.Password {
			http.Error(w, "incorrect password", http.StatusUnauthorized)
			return
		}

		playerID := uuid.New()
		player := &models.Player{
			ID:      playerID,
			Name:    req.UserName,
			Room:    room,
			IsAlive: true,
		}
		room.Players = append(room.Players, player)
		log.Printf("player %s (%s) joined room %s", req.UserName, playerID, req.RoomID)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(joinRoomResponse{PlayerID: playerID.String(), RoomID: req.RoomID})
	}
}

func handleWebSocket(registry *RoomRegistry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		roomID := r.PathValue("roomID")
		name := r.URL.Query().Get("name")
		password := r.URL.Query().Get("password")

		if name == "" {
			http.Error(w, "name is required", http.StatusBadRequest)
			return
		}

		room, ok := registry.Get(roomID)
		if !ok {
			http.Error(w, "room not found", http.StatusNotFound)
			return
		}

		if room.Password != password {
			http.Error(w, "incorrect password", http.StatusUnauthorized)
			return
		}

		// TODO: upgrade to WebSocket, create Player, add to room
		_ = room
		_ = name
		http.Error(w, "websocket upgrade not yet implemented", http.StatusNotImplemented)
	}
}
