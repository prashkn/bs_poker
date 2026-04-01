package main

import (
	"github.com/prashkn/bs-poker/server/service"
)

type server struct {
	roomRegistry  service.RoomRegistryService
	playerService service.PlayerService
	roomService   service.RoomService
}

func NewServer() *server {
	registry := service.NewRoomRegistry()
	roomService := service.NewRoomService()
	playerService := service.NewPlayerService()

	return &server{
		roomRegistry:  registry,
		playerService: playerService,
		roomService:   roomService,
	}
}
