package game

import "testing"

func TestStateMachine_HappyPath(t *testing.T) {
	sm := NewStateMachine()
	if sm.Current != StateNewRound {
		t.Fatalf("expected StateNewRound, got %d", sm.Current)
	}

	// NewRound -> Claim -> Claim -> BSCall -> BSResult -> RoundEnd -> NewRound
	steps := []Transition{
		TransitionClaim, TransitionClaim,
		TransitionBSCall, TransitionBSResult, TransitionRoundEnd, TransitionNewRound,
	}
	for _, tr := range steps {
		if err := sm.MoveTo(tr); err != nil {
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
		TransitionClaim,
		TransitionBSCall, TransitionBSResult, TransitionRoundEnd,
		TransitionGameOver,
	}
	for _, tr := range transitions {
		if err := sm.MoveTo(tr); err != nil {
			t.Fatalf("unexpected error applying transition %d: %v", tr, err)
		}
	}
	if sm.Current != StateGameOver {
		t.Errorf("expected StateGameOver, got %d", sm.Current)
	}
}

func TestStateMachine_InvalidTransition(t *testing.T) {
	sm := NewStateMachine() // starts at NewRound

	invalid := []Transition{
		TransitionNewRound, TransitionBSCall, TransitionBSResult,
		TransitionRoundEnd, TransitionGameOver,
	}
	for _, tr := range invalid {
		if sm.CanMoveTo(tr) {
			t.Errorf("transition %d should not be allowed from NewRound", tr)
		}
		if err := sm.MoveTo(tr); err == nil {
			t.Errorf("expected error for transition %d from NewRound", tr)
		}
	}

	if sm.Current != StateNewRound {
		t.Errorf("state should still be StateNewRound, got %d", sm.Current)
	}
}

func TestStateMachine_Can(t *testing.T) {
	sm := NewStateMachine()

	if !sm.CanMoveTo(TransitionClaim) {
		t.Error("should be able to claim from NewRound")
	}
	if sm.CanMoveTo(TransitionBSCall) {
		t.Error("should not be able to call BS from NewRound")
	}
}

func TestStateMachine_AvailableTransitions(t *testing.T) {
	sm := NewStateMachine()
	available := sm.AvailableTransitions()
	if len(available) != 1 {
		t.Fatalf("expected 1 available transition from NewRound, got %d", len(available))
	}
	if available[0] != TransitionClaim {
		t.Errorf("expected TransitionClaim, got %d", available[0])
	}

	// Move to Claim state — should have 2 transitions (Claim, BSCall)
	sm.MoveTo(TransitionClaim)
	available = sm.AvailableTransitions()
	if len(available) != 2 {
		t.Fatalf("expected 2 available transitions from Claim, got %d", len(available))
	}
}
