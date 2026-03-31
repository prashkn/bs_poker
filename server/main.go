package main

import (
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/prashkn/bs-poker/server/models"
)

// RoomRegistry holds all active rooms, guarded by a RWMutex.
type RoomRegistry struct {
	mu    sync.RWMutex
	rooms map[string]*models.Room
}

func NewRoomRegistry() *RoomRegistry {
	return &RoomRegistry{
		rooms: make(map[string]*models.Room),
	}
}

func (r *RoomRegistry) Get(id string) (*models.Room, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	room, ok := r.rooms[id]
	return room, ok
}

func (r *RoomRegistry) Set(id string, room *models.Room) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.rooms[id] = room
}

func (r *RoomRegistry) Delete(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.rooms, id)
}

// cleanupEmptyRooms periodically removes rooms with no players.
func (r *RoomRegistry) cleanupEmptyRooms(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for range ticker.C {
		r.mu.Lock()
		for id, room := range r.rooms {
			if len(room.Players) == 0 {
				log.Printf("cleaning up empty room %s", id)
				delete(r.rooms, id)
			}
		}
		r.mu.Unlock()
	}
}

func main() {
	registry := NewRoomRegistry()

	// Background goroutine to delete empty rooms every 30s.
	go registry.cleanupEmptyRooms(30 * time.Second)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/rooms", handleCreateRoom(registry))
	mux.HandleFunc("POST /api/rooms/join", handleJoinRoom(registry))
	mux.HandleFunc("GET /ws/{roomID}", handleWebSocket(registry))

	addr := ":8080"
	log.Printf("server listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
