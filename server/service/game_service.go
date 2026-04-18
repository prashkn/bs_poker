package service

import (
	"errors"

	"github.com/google/uuid"
	"github.com/prashkn/bs-poker/server/game"
)

var (
	ErrNotHost           = errors.New("only the host can start the game")
	ErrNotEnoughPlayers  = errors.New("need at least 2 players")
	ErrGameAlreadyActive = errors.New("a game is already in progress")
	ErrNoActiveGame      = errors.New("no active game")
	ErrNotYourTurn       = errors.New("it is not your turn")
	ErrInvalidClaim      = errors.New("invalid hand")
	ErrClaimNotStronger  = errors.New("claim must be stronger than the current claim")
	ErrNoClaim           = errors.New("no claim to call BS on")
	ErrWrongState        = errors.New("invalid game state for this action")
)

type BSResult struct {
	Caller     uuid.UUID                 `json:"caller_id"`
	Claimer    uuid.UUID                 `json:"claimer_id"`
	ClaimValid bool                      `json:"claim_valid"`
	LoserID    uuid.UUID                 `json:"loser_id"`
	AllHands   map[uuid.UUID][]game.Card `json:"all_hands"`
	Eliminated bool                      `json:"eliminated"`
	GameOver   bool                      `json:"game_over"`
	WinnerID   uuid.UUID                 `json:"winner_id,omitempty"`
}

// StartGame initializes a new game in the room. Caller must hold room.Mu.
func StartGame(room *game.Room, playerID uuid.UUID) error {
	if playerID != room.HostID {
		return ErrNotHost
	}
	if room.Session != nil && room.Session.SM.Current != game.StateGameOver {
		return ErrGameAlreadyActive
	}
	if len(room.Players) < 2 {
		return ErrNotEnoughPlayers
	}

	// Reset every player for a fresh game
	for _, p := range room.Players {
		p.IsAlive = true
		p.CardCount = 2
		p.Hand = []game.Card{}
	}

	// Build turn order
	turnOrder := make([]uuid.UUID, 0, len(room.Players))
	for _, p := range room.Players {
		turnOrder = append(turnOrder, p.ID)
	}

	// Create and shuffle deck
	deck := game.NewDeck()
	game.ShuffleDeck(deck)

	// Deal cards
	for _, p := range room.Players {
		var dealt []game.Card
		deck, dealt = game.Deal(deck, p.CardCount)
		p.Hand = dealt
	}

	room.Session = &game.Session{
		Deck:        deck,
		Round:       1,
		TurnOrder:   turnOrder,
		CurrentTurn: 0,
		LastClaim:   nil,
		SM:          game.NewStateMachine(),
	}

	return nil
}

// MakeClaim records a player's claim. Caller must hold room.Mu.
func MakeClaim(room *game.Room, playerID uuid.UUID, claim game.MadeHand) error {
	g := room.Session
	if g == nil {
		return ErrNoActiveGame
	}
	if !g.SM.CanMoveTo(game.TransitionClaim) {
		return ErrWrongState
	}
	if g.TurnOrder[g.CurrentTurn] != playerID {
		return ErrNotYourTurn
	}
	if !claim.IsValid() {
		return ErrInvalidClaim
	}
	if g.LastClaim != nil && !claim.IsStrongerThan(&g.LastClaim.MadeHand) {
		return ErrClaimNotStronger
	}

	g.LastClaim = &game.Claim{
		PlayerID: playerID,
		MadeHand: claim,
	}

	// Advance to next alive player
	g.CurrentTurn = nextAliveTurnIndex(room)
	g.SM.MoveTo(game.TransitionClaim) // NewRound->Claim or Claim->Claim

	return nil
}

// CallBS resolves a BS call. Caller must hold room.Mu.
func CallBS(room *game.Room, playerID uuid.UUID) (*BSResult, error) {
	g := room.Session
	if g == nil {
		return nil, ErrNoActiveGame
	}
	if !g.SM.CanMoveTo(game.TransitionBSCall) {
		return nil, ErrWrongState
	}
	if g.TurnOrder[g.CurrentTurn] != playerID {
		return nil, ErrNotYourTurn
	}
	if g.LastClaim == nil {
		return nil, ErrNoClaim
	}

	g.SM.MoveTo(game.TransitionBSCall) // Claim -> BSCall

	// Collect all alive players' cards and build hands map
	alivePlayers := getAlivePlayers(room)
	allCards := make([]game.Card, 0)
	allHands := make(map[uuid.UUID][]game.Card)
	for _, p := range alivePlayers {
		allCards = append(allCards, p.Hand...)
		handCopy := make([]game.Card, len(p.Hand))
		copy(handCopy, p.Hand)
		allHands[p.ID] = handCopy
	}

	claimValid := VerifyClaim(g.LastClaim.MadeHand, allCards)

	// Determine loser
	var loserID uuid.UUID
	if claimValid {
		loserID = playerID // caller loses
	} else {
		loserID = g.LastClaim.PlayerID // claimer loses
	}

	loser := FindPlayer(room, loserID)
	loser.CardCount++

	result := &BSResult{
		Caller:     playerID,
		Claimer:    g.LastClaim.PlayerID,
		ClaimValid: claimValid,
		LoserID:    loserID,
		AllHands:   allHands,
	}

	g.SM.MoveTo(game.TransitionBSResult) // BSCall -> BSResult

	// Check elimination
	if loser.CardCount >= room.Settings.MaxCardsBeforeElimination {
		loser.IsAlive = false
		result.Eliminated = true
	}

	g.SM.MoveTo(game.TransitionRoundEnd) // BSResult -> RoundEnd

	// Check game over
	alive := getAlivePlayers(room)
	if len(alive) <= 1 {
		g.SM.MoveTo(game.TransitionGameOver) // RoundEnd -> GameOver
		result.GameOver = true
		if len(alive) == 1 {
			result.WinnerID = alive[0].ID
		}
		return result, nil
	}

	// Start new round
	startNewRound(room, loserID) // applies TransitionNewRound internally

	return result, nil
}

// VerifyClaim checks that every card in the claimed hand exists in the pool of all cards.
func VerifyClaim(claim game.MadeHand, allCards []game.Card) bool {
	pool := make([]game.Card, len(allCards))
	copy(pool, allCards)

	for _, claimCard := range claim.Cards {
		found := false
		for i, poolCard := range pool {
			if poolCard.Suit == claimCard.Suit && poolCard.Value == claimCard.Value {
				// Remove matched card from pool
				pool = append(pool[:i], pool[i+1:]...)
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// startNewRound reshuffles, redeals, and resets for the next round.
func startNewRound(room *game.Room, loserID uuid.UUID) {
	g := room.Session
	g.Round++
	g.LastClaim = nil

	// Create and shuffle a new deck
	deck := game.NewDeck()
	game.ShuffleDeck(deck)

	// Deal cards to alive players
	alivePlayers := getAlivePlayers(room)
	for _, p := range alivePlayers {
		var dealt []game.Card
		deck, dealt = game.Deal(deck, p.CardCount)
		p.Hand = dealt
	}
	g.Deck = deck

	// Rebuild turn order from alive players, preserving shuffle from game start
	turnOrder := make([]uuid.UUID, 0, len(alivePlayers))
	for _, id := range g.TurnOrder {
		for _, p := range alivePlayers {
			if p.ID == id {
				turnOrder = append(turnOrder, id)
				break
			}
		}
	}
	g.TurnOrder = turnOrder

	// Loser starts the new round (or next alive if eliminated)
	g.CurrentTurn = 0
	for i, id := range g.TurnOrder {
		if id == loserID {
			g.CurrentTurn = i
			break
		}
	}
	// If loser was eliminated, current turn stays at their former position
	// which now points to the next alive player (since we rebuilt TurnOrder)

	g.SM.MoveTo(game.TransitionNewRound) // RoundEnd -> NewRound
}

// nextAliveTurnIndex returns the next turn index, skipping eliminated players.
func nextAliveTurnIndex(room *game.Room) int {
	g := room.Session
	n := len(g.TurnOrder)
	for i := 1; i < n; i++ {
		idx := (g.CurrentTurn + i) % n
		pid := g.TurnOrder[idx]
		if p := FindPlayer(room, pid); p != nil && p.IsAlive {
			return idx
		}
	}
	return g.CurrentTurn
}

func getAlivePlayers(room *game.Room) []*game.Player {
	alive := make([]*game.Player, 0)
	for _, p := range room.Players {
		if p.IsAlive {
			alive = append(alive, p)
		}
	}
	return alive
}

// FindPlayer returns the player with the given ID, or nil if not found.
func FindPlayer(room *game.Room, playerID uuid.UUID) *game.Player {
	for _, p := range room.Players {
		if p.ID == playerID {
			return p
		}
	}
	return nil
}
