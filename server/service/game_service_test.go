package service

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/prashkn/bs-poker/server/game"
)

func newTestRoom(numPlayers int) *game.Room {
	room := &game.Room{
		ID: "test-room",
		Settings: game.RoomSettings{
			TimePerTurn:               30 * time.Second,
			MaxCardsBeforeElimination: 6,
		},
		Players: make([]*game.Player, 0, numPlayers),
	}
	for i := 0; i < numPlayers; i++ {
		p := &game.Player{
			ID:        uuid.New(),
			Name:      string(rune('A' + i)),
			IsAlive:   true,
			CardCount: 2,
			SendCh:    make(chan []byte, 256),
		}
		room.Players = append(room.Players, p)
	}
	room.HostID = room.Players[0].ID
	return room
}

// --- VerifyClaim ---

func TestVerifyClaim_Valid(t *testing.T) {
	allCards := []game.Card{
		{Suit: game.Hearts, Value: game.Ace},
		{Suit: game.Spades, Value: game.Ace},
		{Suit: game.Clubs, Value: game.King},
		{Suit: game.Diamonds, Value: game.Queen},
	}
	claim := game.MadeHand{
		HandType: game.Pair,
		Cards: []game.Card{
			{Suit: game.Hearts, Value: game.Ace},
			{Suit: game.Spades, Value: game.Ace},
		},
	}
	if !VerifyClaim(claim, allCards) {
		t.Error("expected claim to be valid")
	}
}

func TestVerifyClaim_Invalid(t *testing.T) {
	allCards := []game.Card{
		{Suit: game.Hearts, Value: game.Ace},
		{Suit: game.Clubs, Value: game.King},
		{Suit: game.Diamonds, Value: game.Queen},
	}
	claim := game.MadeHand{
		HandType: game.Pair,
		Cards: []game.Card{
			{Suit: game.Hearts, Value: game.Ace},
			{Suit: game.Spades, Value: game.Ace}, // not in pool
		},
	}
	if VerifyClaim(claim, allCards) {
		t.Error("expected claim to be invalid")
	}
}

func TestVerifyClaim_DuplicateCards(t *testing.T) {
	// Pool has only one Ace of Hearts, claim tries to use it twice
	allCards := []game.Card{
		{Suit: game.Hearts, Value: game.Ace},
		{Suit: game.Clubs, Value: game.King},
	}
	claim := game.MadeHand{
		HandType: game.Pair,
		Cards: []game.Card{
			{Suit: game.Hearts, Value: game.Ace},
			{Suit: game.Hearts, Value: game.Ace},
		},
	}
	if VerifyClaim(claim, allCards) {
		t.Error("expected claim to be invalid when card used twice")
	}
}

// --- StartGame ---

func TestStartGame_Success(t *testing.T) {
	room := newTestRoom(3)
	err := StartGame(room, room.HostID)
	if err != nil {
		t.Fatalf("StartGame failed: %v", err)
	}

	if room.Session == nil {
		t.Fatal("game should be initialized")
	}
	if room.Session.SM.Current != game.StateNewRound {
		t.Errorf("expected StateNewRound, got %d", room.Session.SM.Current)
	}
	if room.Session.Round != 1 {
		t.Errorf("expected round 1, got %d", room.Session.Round)
	}
	if len(room.Session.TurnOrder) != 3 {
		t.Errorf("expected 3 players in turn order, got %d", len(room.Session.TurnOrder))
	}

	// Each player should have 2 cards
	for _, p := range room.Players {
		if len(p.Hand) != 2 {
			t.Errorf("player %s should have 2 cards, got %d", p.Name, len(p.Hand))
		}
	}
}

func TestStartGame_NotHost(t *testing.T) {
	room := newTestRoom(2)
	err := StartGame(room, room.Players[1].ID)
	if err != ErrNotHost {
		t.Errorf("expected ErrNotHost, got %v", err)
	}
}

func TestStartGame_NotEnoughPlayers(t *testing.T) {
	room := newTestRoom(1)
	err := StartGame(room, room.HostID)
	if err != ErrNotEnoughPlayers {
		t.Errorf("expected ErrNotEnoughPlayers, got %v", err)
	}
}

// --- MakeClaim ---

func TestMakeClaim_Success(t *testing.T) {
	room := newTestRoom(2)
	_ = StartGame(room, room.HostID)

	currentPlayerID := room.Session.TurnOrder[room.Session.CurrentTurn]
	claim := game.MadeHand{
		HandType: game.HighCard,
		Cards:    []game.Card{{Suit: game.Hearts, Value: game.Ace}},
	}

	err := MakeClaim(room, currentPlayerID, claim)
	if err != nil {
		t.Fatalf("MakeClaim failed: %v", err)
	}

	if room.Session.CurrentClaim == nil {
		t.Fatal("current claim should be set")
	}
	if room.Session.CurrentClaim.PlayerID != currentPlayerID {
		t.Error("claim player ID mismatch")
	}
}

func TestMakeClaim_WrongTurn(t *testing.T) {
	room := newTestRoom(2)
	_ = StartGame(room, room.HostID)

	// Find the player who is NOT the current turn
	currentPlayerID := room.Session.TurnOrder[room.Session.CurrentTurn]
	var otherPlayerID uuid.UUID
	for _, p := range room.Players {
		if p.ID != currentPlayerID {
			otherPlayerID = p.ID
			break
		}
	}

	claim := game.MadeHand{
		HandType: game.HighCard,
		Cards:    []game.Card{{Suit: game.Hearts, Value: game.Ace}},
	}

	err := MakeClaim(room, otherPlayerID, claim)
	if err != ErrNotYourTurn {
		t.Errorf("expected ErrNotYourTurn, got %v", err)
	}
}

func TestMakeClaim_MustBeStronger(t *testing.T) {
	room := newTestRoom(2)
	_ = StartGame(room, room.HostID)

	// First claim: pair of aces
	p1 := room.Session.TurnOrder[room.Session.CurrentTurn]
	claim1 := game.MadeHand{
		HandType: game.Pair,
		Cards: []game.Card{
			{Suit: game.Hearts, Value: game.Ace},
			{Suit: game.Spades, Value: game.Ace},
		},
	}
	_ = MakeClaim(room, p1, claim1)

	// Second claim: high card (weaker) — should fail
	p2 := room.Session.TurnOrder[room.Session.CurrentTurn]
	claim2 := game.MadeHand{
		HandType: game.HighCard,
		Cards:    []game.Card{{Suit: game.Hearts, Value: game.King}},
	}
	err := MakeClaim(room, p2, claim2)
	if err != ErrClaimNotStronger {
		t.Errorf("expected ErrClaimNotStronger, got %v", err)
	}
}

// --- CallBS ---

func TestCallBS_ClaimInvalid(t *testing.T) {
	room := newTestRoom(2)
	_ = StartGame(room, room.HostID)

	p1 := room.Session.TurnOrder[room.Session.CurrentTurn]
	room.Players[0].Hand = []game.Card{
		{Suit: game.Hearts, Value: game.Two},
		{Suit: game.Clubs, Value: game.Three},
	}
	room.Players[1].Hand = []game.Card{
		{Suit: game.Diamonds, Value: game.Four},
		{Suit: game.Spades, Value: game.Five},
	}

	// Claim a pair of aces — doesn't exist
	claim := game.MadeHand{
		HandType: game.Pair,
		Cards: []game.Card{
			{Suit: game.Hearts, Value: game.Ace},
			{Suit: game.Spades, Value: game.Ace},
		},
	}
	_ = MakeClaim(room, p1, claim)

	// Next player calls BS
	p2 := room.Session.TurnOrder[room.Session.CurrentTurn]
	result, err := CallBS(room, p2)
	if err != nil {
		t.Fatalf("CallBS failed: %v", err)
	}

	if result.ClaimValid {
		t.Error("expected claim to be invalid")
	}
	if result.LoserID != p1 {
		t.Error("claimer should lose when claim is invalid")
	}
}

func TestCallBS_ClaimValid(t *testing.T) {
	room := newTestRoom(2)
	_ = StartGame(room, room.HostID)

	p1 := room.Session.TurnOrder[room.Session.CurrentTurn]

	// Set up hands so the claim is valid
	room.Players[0].Hand = []game.Card{
		{Suit: game.Hearts, Value: game.Ace},
		{Suit: game.Clubs, Value: game.King},
	}
	room.Players[1].Hand = []game.Card{
		{Suit: game.Spades, Value: game.Ace},
		{Suit: game.Diamonds, Value: game.Queen},
	}

	// Claim pair of aces — exists across both hands
	claim := game.MadeHand{
		HandType: game.Pair,
		Cards: []game.Card{
			{Suit: game.Hearts, Value: game.Ace},
			{Suit: game.Spades, Value: game.Ace},
		},
	}
	_ = MakeClaim(room, p1, claim)

	p2 := room.Session.TurnOrder[room.Session.CurrentTurn]
	result, err := CallBS(room, p2)
	if err != nil {
		t.Fatalf("CallBS failed: %v", err)
	}

	if !result.ClaimValid {
		t.Error("expected claim to be valid")
	}
	if result.LoserID != p2 {
		t.Error("caller should lose when claim is valid")
	}
}

func TestCallBS_Elimination(t *testing.T) {
	room := newTestRoom(2)
	room.Settings.MaxCardsBeforeElimination = 3

	_ = StartGame(room, room.HostID)

	p1 := room.Session.TurnOrder[room.Session.CurrentTurn]

	// Set hands so claim is invalid → p1 (claimer) loses
	room.Players[0].Hand = []game.Card{
		{Suit: game.Hearts, Value: game.Two},
		{Suit: game.Clubs, Value: game.Three},
	}
	room.Players[1].Hand = []game.Card{
		{Suit: game.Diamonds, Value: game.Four},
		{Suit: game.Spades, Value: game.Five},
	}

	claim := game.MadeHand{
		HandType: game.Pair,
		Cards: []game.Card{
			{Suit: game.Hearts, Value: game.Ace},
			{Suit: game.Spades, Value: game.Ace},
		},
	}
	_ = MakeClaim(room, p1, claim)

	p2 := room.Session.TurnOrder[room.Session.CurrentTurn]
	result, err := CallBS(room, p2)
	if err != nil {
		t.Fatalf("CallBS failed: %v", err)
	}

	if !result.Eliminated {
		t.Error("expected loser to be eliminated")
	}
	if !result.GameOver {
		t.Error("expected game over with only 2 players")
	}
	if result.WinnerID != p2 {
		t.Error("expected p2 to win")
	}
}

func TestCallBS_NewRound(t *testing.T) {
	room := newTestRoom(3)
	_ = StartGame(room, room.HostID)

	p1 := room.Session.TurnOrder[room.Session.CurrentTurn]

	room.Players[0].Hand = []game.Card{
		{Suit: game.Hearts, Value: game.Two},
		{Suit: game.Clubs, Value: game.Three},
	}
	room.Players[1].Hand = []game.Card{
		{Suit: game.Diamonds, Value: game.Four},
		{Suit: game.Spades, Value: game.Five},
	}
	room.Players[2].Hand = []game.Card{
		{Suit: game.Hearts, Value: game.Six},
		{Suit: game.Clubs, Value: game.Seven},
	}

	claim := game.MadeHand{
		HandType: game.Pair,
		Cards: []game.Card{
			{Suit: game.Hearts, Value: game.Ace},
			{Suit: game.Spades, Value: game.Ace},
		},
	}
	_ = MakeClaim(room, p1, claim)

	p2 := room.Session.TurnOrder[room.Session.CurrentTurn]
	result, err := CallBS(room, p2)
	if err != nil {
		t.Fatalf("CallBS failed: %v", err)
	}

	if result.GameOver {
		t.Error("game should not be over with 3 players")
	}
	if room.Session.Round != 2 {
		t.Errorf("expected round 2, got %d", room.Session.Round)
	}
	if room.Session.CurrentClaim != nil {
		t.Error("current claim should be nil after new round")
	}

	// The loser should have CardCount incremented
	loser := FindPlayer(room, result.LoserID)
	if loser.CardCount != 3 {
		t.Errorf("expected loser card count 3, got %d", loser.CardCount)
	}

	// All alive players should have cards dealt
	for _, p := range room.Players {
		if p.IsAlive && len(p.Hand) != p.CardCount {
			t.Errorf("player %s should have %d cards, got %d", p.Name, p.CardCount, len(p.Hand))
		}
	}
}
