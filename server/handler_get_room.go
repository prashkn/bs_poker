package main

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/prashkn/bs-poker/server/service"
)

// handleGetRoom checks if the room exists. If player_id query param is provided,
// also verifies the player is in the room and not on the kick list.
func handleGetRoom(registry service.RoomRegistryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		roomID := r.PathValue("roomID")

		room, err := registry.GetRoom(roomID)
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

			room.Mu.Lock()
			_, kicked := room.KickedIDs[playerID]
			room.Mu.Unlock()
			if kicked {
				http.Error(w, "you have been kicked from this room", http.StatusForbidden)
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
