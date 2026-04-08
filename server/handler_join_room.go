package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/prashkn/bs-poker/server/game"
	"github.com/prashkn/bs-poker/server/service"
)

type joinRoomRequest struct {
	RoomID     string `json:"room_id"`
	Password   string `json:"password"`
	PlayerName string `json:"player_name"`
}

type joinRoomResponse struct {
	RoomID   string    `json:"room_id"`
	PlayerID uuid.UUID `json:"player_id"`
}

// handleJoinRoom adds a player to an existing room.
func handleJoinRoom(registry service.RoomRegistryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req joinRoomRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		log.Printf("join request: %+v", req)

		// validation
		if req.RoomID == "" {
			http.Error(w, "room_id is required", http.StatusBadRequest)
			return
		}
		if req.Password == "" {
			http.Error(w, "password is required", http.StatusBadRequest)
			return
		}
		if req.PlayerName == "" {
			http.Error(w, "player_name is required", http.StatusBadRequest)
			return
		}

		room, err := registry.GetRoom(req.RoomID)
		if err != nil || room.Password != req.Password {
			// Don't reveal whether the room exists or not if the password is wrong.
			http.Error(w, "room not found", http.StatusNotFound)
			return
		}

		player := game.NewPlayer(req.PlayerName)
		err = registry.AddPlayerToRoom(room.ID, player)
		if err != nil {
			if err == service.ErrPlayerNameTaken {
				http.Error(w, "player name already taken in this room", http.StatusConflict)
				return
			}
			http.Error(w, "failed to add player to room", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(joinRoomResponse{RoomID: req.RoomID, PlayerID: player.ID})
	}
}
