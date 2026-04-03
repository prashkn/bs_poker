package main

import (
	"github.com/prashkn/bs-poker/server/service"
)

type server struct {
	roomRegistryService service.RoomRegistryService
}

func NewServer() *server {
	registry := service.NewRoomRegistryService()

	return &server{
		roomRegistryService: registry,
	}
}
