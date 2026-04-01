package main

import (
	"log"
	"net/http"
	"time"
)

func main() {
	server := NewServer()

	// Background goroutine to delete empty rooms every 30s.
	go server.roomRegistry.CleanupEmptyRooms(30 * time.Second)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/rooms", handleCreateRoom(server.roomService))
	mux.HandleFunc("POST /api/rooms/join", handleJoinRoom(server.roomRegistry))
	mux.HandleFunc("GET /ws/{roomID}", handleWebSocket(server.roomRegistry))

	addr := ":8080"
	log.Printf("server listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
