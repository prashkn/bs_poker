package game

import "testing"

func TestStateMachine_HappyPath(t *testing.T) {
	sm := NewStateMachine()
	if sm.Current != StateLobby {
		t.Fatalf("expected StateLobby, got %d", sm.Current)
	}

	// Lobby -> NewRound -> Claim -> Claim -> BSCall -> BSResult -> RoundEnd -> NewRound
	steps := []Transition{
		TransitionNewRound, TransitionClaim, TransitionClaim,
		TransitionBSCall, TransitionBSResult, TransitionRoundEnd, TransitionNewRound,
	}
	for _, tr := range steps {
		if err := sm.Apply(tr); err != nil {
			t.Fatalf("unexpected error applying transition %d: %v", tr, err)
		}
	}
	if sm.Current != StateNewRound {
		t.Errorf("expected StateNewRound, got %d", sm.Current)
	}
}

func TestStateMachine_GameOverPath(t *testing.T) {
	sm := NewStateMachine()
	transitions := []Transition{
		TransitionNewRound, TransitionClaim,
		TransitionBSCall, TransitionBSResult, TransitionRoundEnd,
		TransitionGameOver,
	}
	for _, tr := range transitions {
		if err := sm.Apply(tr); err != nil {
			t.Fatalf("unexpected error applying transition %d: %v", tr, err)
		}
	}
	if sm.Current != StateGameOver {
		t.Errorf("expected StateGameOver, got %d", sm.Current)
	}

	if err := sm.Apply(TransitionBackLobby); err != nil {
		t.Fatalf("unexpected error on BackLobby: %v", err)
	}
	if sm.Current != StateLobby {
		t.Errorf("expected StateLobby, got %d", sm.Current)
	}
}

func TestStateMachine_InvalidTransition(t *testing.T) {
	sm := NewStateMachine() // starts at Lobby

	invalid := []Transition{
		TransitionClaim, TransitionBSCall, TransitionBSResult,
		TransitionRoundEnd, TransitionGameOver, TransitionBackLobby,
	}
	for _, tr := range invalid {
		if sm.Can(tr) {
			t.Errorf("transition %d should not be allowed from Lobby", tr)
		}
		if err := sm.Apply(tr); err == nil {
			t.Errorf("expected error for transition %d from Lobby", tr)
		}
	}

	// Should still be in Lobby after all rejected transitions
	if sm.Current != StateLobby {
		t.Errorf("state should still be StateLobby, got %d", sm.Current)
	}
}

func TestStateMachine_Can(t *testing.T) {
	sm := NewStateMachine()

	if !sm.Can(TransitionNewRound) {
		t.Error("should be able to start new round from Lobby")
	}
	if sm.Can(TransitionClaim) {
		t.Error("should not be able to claim from Lobby")
	}
}

func TestStateMachine_AvailableTransitions(t *testing.T) {
	sm := NewStateMachine()
	available := sm.AvailableTransitions()
	if len(available) != 1 {
		t.Fatalf("expected 1 available transition from Lobby, got %d", len(available))
	}
	if available[0] != TransitionNewRound {
		t.Errorf("expected TransitionNewRound, got %d", available[0])
	}

	// Move to Claim state — should have 2 transitions (Claim, BSCall)
	sm.Apply(TransitionNewRound)
	sm.Apply(TransitionClaim)
	available = sm.AvailableTransitions()
	if len(available) != 2 {
		t.Fatalf("expected 2 available transitions from Claim, got %d", len(available))
	}
}
