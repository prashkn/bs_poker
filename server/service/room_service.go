package service

import (
	"errors"
	"log"
	"math/rand"
	"strings"
	"time"

	"github.com/wordgen/wordlists"

	"github.com/prashkn/bs-poker/server/models"
)

var (
	ErrHostNameRequired = errors.New("host_name is required")
	ErrPasswordRequired = errors.New("password is required")
)

type roomService struct{}

var _ RoomService = (*roomService)(nil)

func NewRoomService() *roomService {
	return &roomService{}
}

type RoomService interface {
	CreateRoom(password string) (*models.Room, error)
}

func (s *roomService) CreateRoom(password string) (*models.Room, error) {
	if password == "" {
		return nil, ErrPasswordRequired
	}

	roomID := generateRoomID()
	room := &models.Room{
		ID:       roomID,
		Password: password,
		Players:  []*models.Player{},
		Settings: models.RoomSettings{
			TimePerTurn:               30 * time.Second,
			MaxCardsBeforeElimination: 6,
		},
		CreatedAt: time.Now(),
	}

	log.Printf("room created: %s", room.ID)

	return room, nil
}

func generateRoomID() string {
	words := wordlists.EffShort1
	wordLen := len(words)
	return strings.Join([]string{words[rand.Intn(wordLen)], words[rand.Intn(wordLen)], words[rand.Intn(wordLen)]}, "-")
}
