package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/prashkn/bs-poker/server/game"
	"github.com/prashkn/bs-poker/server/service"
)

type createRoomRequest struct {
	Password string `json:"password"`
	HostName string `json:"host_name"`
}

type createRoomResponse struct {
	RoomID string    `json:"room_id"`
	HostID uuid.UUID `json:"player_id"`
}

// handleCreateRoom creates a new room and adds the host into it.
func handleCreateRoom(registry service.RoomRegistryService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req createRoomRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		// validation
		if req.HostName == "" {
			http.Error(w, "host_name is required", http.StatusBadRequest)
			return
		}
		if req.Password == "" {
			http.Error(w, "password is required", http.StatusBadRequest)
			return
		}

		room := registry.CreateRoom(req.Password)
		host := game.NewPlayer(req.HostName)
		err := registry.AddPlayerToRoom(room.ID, host)
		if err != nil {
			http.Error(w, "failed to add host to room", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(createRoomResponse{RoomID: room.ID, HostID: host.ID})

		log.Printf("Created room %s with host %s (%s)", room.ID, host.Name, host.ID)
	}
}
