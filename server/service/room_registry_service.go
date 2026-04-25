package service

import (
	"errors"
	"log"
	"math/rand"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/prashkn/bs-poker/server/game"
	"github.com/wordgen/wordlists"
)

var (
	ErrRoomNotFound    = errors.New("room not found")
	ErrPlayerNameTaken = errors.New("player name already taken in this room")
	ErrPlayerNotFound  = errors.New("player not found")
)

type roomRegistryService struct {
	mu    sync.RWMutex
	rooms map[string]*game.Room
}

func NewRoomRegistryService() *roomRegistryService {
	return &roomRegistryService{
		rooms: make(map[string]*game.Room),
	}
}

type RoomRegistryService interface {
	GetRoom(id string) (*game.Room, error)
	CreateRoom(password string) *game.Room
	DeleteRoom(id string)
	AddPlayerToRoom(roomID string, player *game.Player) error
	RemovePlayerFromRoom(roomID string, playerID uuid.UUID) (hostChanged bool, err error)
	GetPlayerInRoom(roomID string, playerID uuid.UUID) (*game.Player, error)
	CleanupEmptyRooms(interval time.Duration)
}

func (r *roomRegistryService) GetRoom(id string) (*game.Room, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	room, ok := r.rooms[id]
	if !ok {
		return nil, ErrRoomNotFound
	}

	return room, nil
}

// CreateRoom creates a new room with the given password and adds it to the registry.
func (r *roomRegistryService) CreateRoom(password string) *game.Room {
	r.mu.Lock()
	defer r.mu.Unlock()

	id := generateRoomID()
	// In the unlikely event of a collision, generate a new ID.
	for _, exists := r.rooms[id]; exists; {
		id = generateRoomID()
	}

	r.rooms[id] = &game.Room{
		ID:        id,
		Password:  password,
		Players:   make(map[uuid.UUID]*game.Player),
		KickedIDs: make(map[uuid.UUID]struct{}),
		Settings: game.RoomSettings{
			TimePerTurn:               30 * time.Second,
			MaxCardsBeforeElimination: 6,
		},
		CreatedAt: time.Now(),
	}

	return r.rooms[id]
}

func (r *roomRegistryService) DeleteRoom(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.rooms, id)
}

func (r *roomRegistryService) AddPlayerToRoom(roomID string, player *game.Player) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	room, ok := r.rooms[roomID]
	if !ok {
		return ErrRoomNotFound
	}

	for _, p := range room.Players {
		if p.Name == player.Name {
			return ErrPlayerNameTaken
		}
	}

	// if there are no players, this player becomes the host
	if len(room.Players) == 0 {
		room.HostID = player.ID
	}

	room.Players[player.ID] = player
	return nil
}

// RemovePlayerFromRoom removes a player from the room. Returns true if the host was removed and a new host was assigned.
func (r *roomRegistryService) RemovePlayerFromRoom(roomID string, playerID uuid.UUID) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	room, ok := r.rooms[roomID]
	if !ok {
		return false, ErrRoomNotFound
	}

	delete(room.Players, playerID)

	if room.HostID == playerID {
		for _, p := range room.Players {
			room.HostID = p.ID
			return true, nil
		}
		// no players left, reset host
		room.HostID = uuid.Nil
	}

	return false, nil
}

func (r *roomRegistryService) GetPlayerInRoom(roomID string, playerID uuid.UUID) (*game.Player, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	room, ok := r.rooms[roomID]
	if !ok {
		return nil, ErrRoomNotFound
	}

	player, ok := room.Players[playerID]
	if !ok {
		return nil, ErrPlayerNotFound
	}

	return player, nil
}

// CleanupEmptyRooms periodically removes rooms with no players.
func (r *roomRegistryService) CleanupEmptyRooms(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for range ticker.C {
		r.mu.Lock()
		for id, room := range r.rooms {
			if len(room.Players) == 0 && time.Since(room.CreatedAt) > 24*time.Hour {
				log.Printf("cleaning up empty room %s", id)
				delete(r.rooms, id)
			}
		}
		r.mu.Unlock()
	}
}

func generateRoomID() string {
	words := wordlists.EffShort1
	wordLen := len(words)

	// ex: "blue-sky-apple"
	roomIDArr := []string{}
	for i := 0; i < 3; i++ {
		roomIDArr = append(roomIDArr, words[rand.Intn(wordLen)])
	}
	return strings.Join(roomIDArr, "-")
}
