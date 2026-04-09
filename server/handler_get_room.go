package main

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/prashkn/bs-poker/server/service"
)

type getRoomRequest struct {
	RoomID   string `json:"room_id"`
	PlayerID string `json:"player_id"`
}

// handleGetRoom checks if the room exists and the player is in the room.
func handleGetRoom(registry service.RoomRegistryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req getRoomRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		playerID, err := uuid.Parse(req.PlayerID)
		if err != nil {
			http.Error(w, "invalid player_id", http.StatusBadRequest)
			return
		}

		_, roomErr := registry.GetRoom(req.RoomID)
		_, playerInRoomErr := registry.GetPlayerInRoom(req.RoomID, playerID)

		if roomErr != nil || playerInRoomErr != nil {
			http.Error(w, "room not found", http.StatusNotFound)
			return
		}

		w.WriteHeader(http.StatusOK)
	}
}
