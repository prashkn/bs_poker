package main

import (
	"github.com/prashkn/bs-poker/server/service"
)

type server struct {
	roomRegistryService service.RoomRegistryService
}

func NewServer() *server {
	return &server{
		roomRegistryService: service.NewRoomRegistryService(),
	}
}
