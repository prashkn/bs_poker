package service

import (
	"errors"

	"github.com/google/uuid"
	"github.com/prashkn/bs-poker/server/models"
)

var (
	ErrPlayerNameRequired = errors.New("player name is required")
)

type playerService struct{}

var _ PlayerService = (*playerService)(nil)

func NewPlayerService() *playerService {
	return &playerService{}
}

type PlayerService interface {
	CreatePlayer(name string) (*models.Player, error)
}

func (s *playerService) CreatePlayer(name string) (*models.Player, error) {
	if name == "" {
		return nil, ErrPlayerNameRequired
	}

	playerID := uuid.New()
	player := &models.Player{
		ID:      playerID,
		Name:    name,
		IsAlive: true,
	}

	return player, nil
}
