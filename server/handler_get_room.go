package main

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/prashkn/bs-poker/server/service"
)

// handleGetRoom checks if the room exists. If player_id query param is provided,
// also verifies the player is in the room.
func handleGetRoom(registry service.RoomRegistryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		roomID := r.PathValue("roomID")

		_, err := registry.GetRoom(roomID)
		if err != nil {
			http.Error(w, "room not found", http.StatusNotFound)
			return
		}

		// If player_id is provided, verify membership
		playerIDStr := r.URL.Query().Get("player_id")
		if playerIDStr != "" {
			playerID, err := uuid.Parse(playerIDStr)
			if err != nil {
				http.Error(w, "invalid player_id", http.StatusBadRequest)
				return
			}
			_, err = registry.GetPlayerInRoom(roomID, playerID)
			if err != nil {
				http.Error(w, "player not found in room", http.StatusNotFound)
				return
			}
		}

		w.WriteHeader(http.StatusOK)
	}
}
