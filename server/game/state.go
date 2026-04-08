package game

import "fmt"

// GameState represents a node in the state graph.
type GameState int

const (
	StateLobby    GameState = iota
	StateNewRound
	StateClaim
	StateBSCall
	StateBSResult
	StateRoundEnd
	StateGameOver
)

// Transition represents an edge (verb) in the state graph.
type Transition int

const (
	TransitionNewRound  Transition = iota // Lobby->NewRound, RoundEnd->NewRound
	TransitionClaim                       // NewRound->Claim, Claim->Claim
	TransitionBSCall                      // Claim->BSCall
	TransitionBSResult                    // BSCall->BSResult
	TransitionRoundEnd                    // BSResult->RoundEnd
	TransitionGameOver                    // RoundEnd->GameOver
	TransitionBackLobby                   // GameOver->Lobby
)

type edge struct {
	From GameState
	To   GameState
}

// graph is the adjacency list: transition -> allowed edges.
var graph = map[Transition][]edge{
	TransitionNewRound:  {{StateLobby, StateNewRound}, {StateRoundEnd, StateNewRound}},
	TransitionClaim:     {{StateNewRound, StateClaim}, {StateClaim, StateClaim}},
	TransitionBSCall:    {{StateClaim, StateBSCall}},
	TransitionBSResult:  {{StateBSCall, StateBSResult}},
	TransitionRoundEnd:  {{StateBSResult, StateRoundEnd}},
	TransitionGameOver:  {{StateRoundEnd, StateGameOver}},
	TransitionBackLobby: {{StateGameOver, StateLobby}},
}

// StateMachine tracks current state and validates transitions.
type StateMachine struct {
	Current GameState `json:"current"`
}

// NewStateMachine creates a state machine starting in StateLobby.
func NewStateMachine() StateMachine {
	return StateMachine{Current: StateLobby}
}

// Can reports whether the given transition is valid from the current state.
func (sm *StateMachine) Can(t Transition) bool {
	for _, e := range graph[t] {
		if e.From == sm.Current {
			return true
		}
	}
	return false
}

// Apply performs the transition, moving to the target state.
// Returns an error if the transition is not valid from the current state.
func (sm *StateMachine) Apply(t Transition) error {
	for _, e := range graph[t] {
		if e.From == sm.Current {
			sm.Current = e.To
			return nil
		}
	}
	return fmt.Errorf("invalid transition %d from state %d", t, sm.Current)
}

// AvailableTransitions returns all transitions valid from the current state.
func (sm *StateMachine) AvailableTransitions() []Transition {
	var result []Transition
	for t, edges := range graph {
		for _, e := range edges {
			if e.From == sm.Current {
				result = append(result, t)
				break
			}
		}
	}
	return result
}
