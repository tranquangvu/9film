package learning

import "testing"

func TestApplySM2_FirstSuccessesGrowInterval(t *testing.T) {
	// A freshly-seeded word (ease 2.5, interval 1, reps 1) graded "good" twice
	// should follow SM-2's canonical 1 → 6 → round(6*ease) progression.
	ease, interval, reps := applySM2(2.5, 1, 1, "good")
	if reps != 2 || interval != 6 {
		t.Fatalf("after 2nd good: got reps=%d interval=%d, want reps=2 interval=6", reps, interval)
	}
	ease, interval, reps = applySM2(ease, interval, reps, "good")
	if reps != 3 {
		t.Fatalf("after 3rd good: got reps=%d, want 3", reps)
	}
	if interval <= 6 {
		t.Fatalf("after 3rd good: interval should exceed 6, got %d", interval)
	}
}

func TestApplySM2_AgainLapsesAndResets(t *testing.T) {
	// A lapse restarts the streak and shortens the interval regardless of prior state.
	ease, interval, reps := applySM2(2.6, 30, 5, "again")
	if reps != 0 {
		t.Fatalf("lapse should reset reps to 0, got %d", reps)
	}
	if interval != 1 {
		t.Fatalf("lapse should reset interval to 1 day, got %d", interval)
	}
	if ease >= 2.6 {
		t.Fatalf("lapse should lower ease, got %v (was 2.6)", ease)
	}
}

func TestApplySM2_EaseFlooredAt1_3(t *testing.T) {
	// Repeated "again" must never drive ease below the SM-2 floor.
	ease := 1.3
	for i := 0; i < 10; i++ {
		ease, _, _ = applySM2(ease, 1, 0, "again")
	}
	if ease < 1.3 {
		t.Fatalf("ease fell below floor: %v", ease)
	}
}

func TestApplySM2_HardAdvancesCautiously(t *testing.T) {
	// "Hard" on an established card should still advance but not faster than "good".
	_, hardInterval, _ := applySM2(2.5, 20, 3, "hard")
	_, goodInterval, _ := applySM2(2.5, 20, 3, "good")
	if hardInterval > goodInterval {
		t.Fatalf("hard interval (%d) should not exceed good interval (%d)", hardInterval, goodInterval)
	}
	if hardInterval <= 20 {
		t.Fatalf("hard should still advance past the current interval, got %d", hardInterval)
	}
}

func TestApplySM2_UnknownGradeTreatedAsGood(t *testing.T) {
	_, i1, r1 := applySM2(2.5, 1, 1, "bogus")
	_, i2, r2 := applySM2(2.5, 1, 1, "good")
	if i1 != i2 || r1 != r2 {
		t.Fatalf("unknown grade should behave like good: got (%d,%d) vs (%d,%d)", i1, r1, i2, r2)
	}
}
