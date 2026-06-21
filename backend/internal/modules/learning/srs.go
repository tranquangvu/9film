package learning

import (
	"fmt"
	"math"
	"time"
)

// Spaced-repetition (SM-2) scheduling. A word enters the schedule when it is first
// completed (CompleteWord seeds due_at). Each review the user grades their recall,
// which adjusts the ease factor and pushes the next review further out.

// sqliteTimeLayout matches SQLite's datetime('now') output, so dates computed in
// Go compare correctly against DB-stamped ones (the frontend parseDate handles it).
const sqliteTimeLayout = "2006-01-02 15:04:05"

// gradeQuality maps the four review buttons to an SM-2 quality score (0–5).
// Below 3 is a lapse (the user failed to recall and the word restarts).
func gradeQuality(grade string) (int, bool) {
	switch grade {
	case "again":
		return 2, true
	case "hard":
		return 3, true
	case "good":
		return 4, true
	case "easy":
		return 5, true
	default:
		return 0, false
	}
}

// applySM2 computes the next schedule from the current state and a recall grade.
// It returns the new ease factor, interval (days), and rep count. Pure function —
// covered by srs_test.go.
func applySM2(ease float64, interval, reps int, grade string) (float64, int, int) {
	q, ok := gradeQuality(grade)
	if !ok {
		q = 4 // treat an unknown grade as "good" rather than corrupt the schedule
	}
	if ease < 1.3 {
		ease = 2.5 // guard against an unseeded/legacy row
	}

	// SM-2 ease update, floored at 1.3.
	ease = ease + (0.1 - float64(5-q)*(0.08+float64(5-q)*0.02))
	if ease < 1.3 {
		ease = 1.3
	}

	// A lapse (Again) restarts the word: short interval, streak reset.
	if q < 3 {
		return ease, 1, 0
	}

	reps++
	var next int
	switch reps {
	case 1:
		next = 1
	case 2:
		next = 6
	default:
		next = int(math.Round(float64(interval) * ease))
	}
	// "Hard" advances, but more cautiously than the ease factor alone would.
	if grade == "hard" && reps > 2 {
		hard := int(math.Round(float64(interval) * 1.2))
		if hard < next {
			next = hard
		}
	}
	if next < 1 {
		next = 1
	}
	return ease, next, reps
}

func (s *service) GetDueReviews(userID int64, limit int) ([]Word, error) {
	return s.repo.GetDueReviews(userID, limit)
}

// SubmitReview grades a due word and writes its next SM-2 schedule, returning the
// updated word so the client can drop it from the due queue.
func (s *service) SubmitReview(userID int64, word, grade string) (*Word, error) {
	if _, ok := gradeQuality(grade); !ok {
		return nil, fmt.Errorf("invalid grade %q", grade)
	}
	w, err := s.repo.GetWord(userID, word)
	if err != nil {
		return nil, err
	}
	if w == nil || w.DueAt == "" {
		return nil, fmt.Errorf("word not scheduled for review")
	}

	ease, interval, reps := applySM2(w.Ease, w.Interval, w.Reps, grade)
	dueAt := time.Now().UTC().AddDate(0, 0, interval).Format(sqliteTimeLayout)
	if err := s.repo.UpdateSchedule(userID, word, ease, interval, reps, dueAt); err != nil {
		return nil, err
	}
	w.Ease, w.Interval, w.Reps, w.DueAt = ease, interval, reps, dueAt
	return w, nil
}
