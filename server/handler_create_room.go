package main

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/prashkn/bs-poker/server/service"
)

type createRoomRequest struct {
	Password string `json:"password"`
	HostName string `json:"host_name"`
}

type createRoomResponse struct {
	RoomID string `json:"room_id"`
	HostID string `json:"host_id"`
}

// handleCreateRoom creates a new room and adds the host into it.
func handleCreateRoom(roomService service.RoomService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req createRoomRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		room, err := roomService.CreateRoom(req.Password)
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, service.ErrHostNameRequired) || errors.Is(err, service.ErrPasswordRequired) {
				status = http.StatusBadRequest
			}
			http.Error(w, err.Error(), status)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(createRoomResponse{RoomID: room.ID, HostID: room.HostID.String()})
	}
}
