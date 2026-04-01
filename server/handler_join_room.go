package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/prashkn/bs-poker/server/models"
	"github.com/prashkn/bs-poker/server/service"
)

type joinRoomRequest struct {
	RoomID   string `json:"room_id"`
	Password string `json:"password"`
	UserName string `json:"user_name"`
}

type joinRoomResponse struct {
	PlayerID string `json:"player_id"`
	RoomID   string `json:"room_id"`
}

func handleJoinRoom(registry *service.RoomRegistry) http.HandlerFunc {
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
