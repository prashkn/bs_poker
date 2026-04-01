package service

import (
	"log"
	"sync"
	"time"

	"github.com/prashkn/bs-poker/server/models"
)

type roomRegistry struct {
	mu    sync.RWMutex
	rooms map[string]*models.Room
}

func NewRoomRegistry() *roomRegistry {
	return &roomRegistry{
		rooms: make(map[string]*models.Room),
	}
}

type RoomRegistryService interface {
	Get(id string) (*models.Room, bool)
	Set(id string, room *models.Room)
	Delete(id string)
	CleanupEmptyRooms(interval time.Duration)
}

func (r *roomRegistry) Get(id string) (*models.Room, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	room, ok := r.rooms[id]
	return room, ok
}

func (r *roomRegistry) Set(id string, room *models.Room) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.rooms[id] = room
}

func (r *roomRegistry) Delete(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.rooms, id)
}

// CleanupEmptyRooms periodically removes rooms with no players.
func (r *roomRegistry) CleanupEmptyRooms(interval time.Duration) {
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
