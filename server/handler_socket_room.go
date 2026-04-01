package main

import (
	"net/http"

	"github.com/prashkn/bs-poker/server/service"
)

func handleWebSocket(registry *service.RoomRegistry) http.HandlerFunc {
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
