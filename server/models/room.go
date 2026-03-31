package models

type Room struct {
	ID       string `json:"id"`
	Password string `json:"password,omitempty"`
}
