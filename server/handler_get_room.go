package main

import (
	"encoding/json"
	"net/http"

	"github.com/prashkn/bs-poker/server/service"
)

func handleGetRoom(registry service.RoomRegistryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		roomID := r.PathValue("roomID")

		room, err := registry.GetRoom(roomID)
		if err != nil {
			http.Error(w, "room not found", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"room_id":      room.ID,
			"player_count": len(room.Players),
		})
	}
}
