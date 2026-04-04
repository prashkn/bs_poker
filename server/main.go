package main

import (
	"log"
	"net/http"
	"time"
)

func main() {
	server := NewServer()

	// Background goroutine to delete empty rooms every 30m.
	go server.roomRegistryService.CleanupEmptyRooms(30 * time.Minute)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/rooms", handleCreateRoom(server.roomRegistryService))
	mux.HandleFunc("POST /api/rooms/join", handleJoinRoom(server.roomRegistryService))
	mux.HandleFunc("GET /api/rooms/{roomID}", handleGetRoom(server.roomRegistryService))
	mux.HandleFunc("GET /ws/{roomID}", handleWebSocket(server.roomRegistryService))

	addr := ":8080"
	log.Printf("server listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
