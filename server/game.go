package main

import (
	"errors"
	"math/rand/v2"

	"github.com/google/uuid"
	"github.com/prashkn/bs-poker/server/models"
)

var (
	ErrNotHost           = errors.New("only the host can start the game")
	ErrNotEnoughPlayers  = errors.New("need at least 2 alive players")
	ErrGameAlreadyActive = errors.New("a game is already in progress")
	ErrNoActiveGame      = errors.New("no active game")
	ErrNotYourTurn       = errors.New("it is not your turn")
	ErrInvalidClaim      = errors.New("invalid hand")
	ErrClaimNotStronger  = errors.New("claim must be stronger than the current claim")
	ErrNoClaim           = errors.New("no claim to call BS on")
	ErrWrongState        = errors.New("invalid game state for this action")
)

type BSResult struct {
	Caller     uuid.UUID                `json:"caller_id"`
	Claimer    uuid.UUID                `json:"claimer_id"`
	ClaimValid bool                     `json:"claim_valid"`
	LoserID    uuid.UUID                `json:"loser_id"`
	AllHands   map[uuid.UUID][]models.Card `json:"all_hands"`
	Eliminated bool                     `json:"eliminated"`
	GameOver   bool                     `json:"game_over"`
	WinnerID   uuid.UUID                `json:"winner_id,omitempty"`
}

// StartGame initializes a new game in the room. Caller must hold room.Mu.
func StartGame(room *models.Room, playerID uuid.UUID) error {
	if playerID != room.HostID {
		return ErrNotHost
	}
	if room.Game != nil && room.Game.State != models.StateGameOver {
		return ErrGameAlreadyActive
	}

	alivePlayers := getAlivePlayers(room)
	if len(alivePlayers) < 2 {
		return ErrNotEnoughPlayers
	}

	// Build turn order (shuffled)
	turnOrder := make([]uuid.UUID, len(alivePlayers))
	for i, p := range alivePlayers {
		turnOrder[i] = p.ID
	}
	rand.Shuffle(len(turnOrder), func(i, j int) {
		turnOrder[i], turnOrder[j] = turnOrder[j], turnOrder[i]
	})

	// Create and shuffle deck, deal cards
	deck := models.NewDeck()
	models.ShuffleDeck(deck)

	for _, p := range alivePlayers {
		var dealt []models.Card
		deck, dealt = models.Deal(deck, p.CardCount)
		p.Hand = dealt
	}

	room.Game = &models.Game{
		Deck:         deck,
		Round:        1,
		TurnOrder:    turnOrder,
		CurrentTurn:  0,
		CurrentClaim: nil,
		State:        models.StateTurn,
	}

	return nil
}

// MakeClaim records a player's claim. Caller must hold room.Mu.
func MakeClaim(room *models.Room, playerID uuid.UUID, claim models.MadeHand) error {
	game := room.Game
	if game == nil {
		return ErrNoActiveGame
	}
	if game.State != models.StateTurn {
		return ErrWrongState
	}
	if game.TurnOrder[game.CurrentTurn] != playerID {
		return ErrNotYourTurn
	}
	if !claim.IsValid() {
		return ErrInvalidClaim
	}
	if game.CurrentClaim != nil && !claim.IsStrongerThan(&game.CurrentClaim.MadeHand) {
		return ErrClaimNotStronger
	}

	game.CurrentClaim = &models.Claim{
		PlayerID: playerID,
		MadeHand: claim,
	}

	// Advance to next alive player
	game.CurrentTurn = nextAliveTurnIndex(room)

	return nil
}

// CallBS resolves a BS call. Caller must hold room.Mu.
func CallBS(room *models.Room, playerID uuid.UUID) (*BSResult, error) {
	game := room.Game
	if game == nil {
		return nil, ErrNoActiveGame
	}
	if game.State != models.StateTurn {
		return nil, ErrWrongState
	}
	if game.TurnOrder[game.CurrentTurn] != playerID {
		return nil, ErrNotYourTurn
	}
	if game.CurrentClaim == nil {
		return nil, ErrNoClaim
	}

	// Collect all alive players' cards and build hands map
	alivePlayers := getAlivePlayers(room)
	allCards := make([]models.Card, 0)
	allHands := make(map[uuid.UUID][]models.Card)
	for _, p := range alivePlayers {
		allCards = append(allCards, p.Hand...)
		handCopy := make([]models.Card, len(p.Hand))
		copy(handCopy, p.Hand)
		allHands[p.ID] = handCopy
	}

	claimValid := VerifyClaim(game.CurrentClaim.MadeHand, allCards)

	// Determine loser
	var loserID uuid.UUID
	if claimValid {
		loserID = playerID // caller loses
	} else {
		loserID = game.CurrentClaim.PlayerID // claimer loses
	}

	loser := findPlayer(room, loserID)
	loser.CardCount++

	result := &BSResult{
		Caller:     playerID,
		Claimer:    game.CurrentClaim.PlayerID,
		ClaimValid: claimValid,
		LoserID:    loserID,
		AllHands:   allHands,
	}

	// Check elimination
	if loser.CardCount >= room.Settings.MaxCardsBeforeElimination {
		loser.IsAlive = false
		result.Eliminated = true
	}

	// Check game over
	alive := getAlivePlayers(room)
	if len(alive) <= 1 {
		game.State = models.StateGameOver
		result.GameOver = true
		if len(alive) == 1 {
			result.WinnerID = alive[0].ID
		}
		return result, nil
	}

	// Start new round
	startNewRound(room, loserID)

	return result, nil
}

// VerifyClaim checks that every card in the claimed hand exists in the pool of all cards.
func VerifyClaim(claim models.MadeHand, allCards []models.Card) bool {
	pool := make([]models.Card, len(allCards))
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
func startNewRound(room *models.Room, loserID uuid.UUID) {
	game := room.Game
	game.Round++
	game.CurrentClaim = nil

	// Create and shuffle a new deck
	deck := models.NewDeck()
	models.ShuffleDeck(deck)

	// Deal cards to alive players
	alivePlayers := getAlivePlayers(room)
	for _, p := range alivePlayers {
		var dealt []models.Card
		deck, dealt = models.Deal(deck, p.CardCount)
		p.Hand = dealt
	}
	game.Deck = deck

	// Rebuild turn order from alive players, preserving shuffle from game start
	turnOrder := make([]uuid.UUID, 0, len(alivePlayers))
	for _, id := range game.TurnOrder {
		for _, p := range alivePlayers {
			if p.ID == id {
				turnOrder = append(turnOrder, id)
				break
			}
		}
	}
	game.TurnOrder = turnOrder

	// Loser starts the new round (or next alive if eliminated)
	game.CurrentTurn = 0
	for i, id := range game.TurnOrder {
		if id == loserID {
			game.CurrentTurn = i
			break
		}
	}
	// If loser was eliminated, current turn stays at their former position
	// which now points to the next alive player (since we rebuilt TurnOrder)

	game.State = models.StateTurn
}

// nextAliveTurnIndex returns the next turn index, skipping eliminated players.
func nextAliveTurnIndex(room *models.Room) int {
	game := room.Game
	n := len(game.TurnOrder)
	for i := 1; i < n; i++ {
		idx := (game.CurrentTurn + i) % n
		pid := game.TurnOrder[idx]
		if p := findPlayer(room, pid); p != nil && p.IsAlive {
			return idx
		}
	}
	return game.CurrentTurn
}

func getAlivePlayers(room *models.Room) []*models.Player {
	alive := make([]*models.Player, 0)
	for _, p := range room.Players {
		if p.IsAlive {
			alive = append(alive, p)
		}
	}
	return alive
}

func findPlayer(room *models.Room, playerID uuid.UUID) *models.Player {
	for _, p := range room.Players {
		if p.ID == playerID {
			return p
		}
	}
	return nil
}
