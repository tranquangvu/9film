package cache

import (
	"testing"
	"time"
)

func TestTTLGetSet(t *testing.T) {
	c := NewTTL[int](time.Hour)

	if _, ok := c.Get("missing"); ok {
		t.Fatal("expected miss on empty cache")
	}

	c.Set("a", 42)
	if got, ok := c.Get("a"); !ok || got != 42 {
		t.Fatalf("got (%d, %v), want (42, true)", got, ok)
	}
}

func TestTTLExpiry(t *testing.T) {
	c := NewTTL[string](-time.Second) // already-expired entries

	c.Set("k", "v")
	if _, ok := c.Get("k"); ok {
		t.Fatal("expected expired entry to be a miss")
	}
}

func TestTTLSetBoundedCapsPerGroup(t *testing.T) {
	c := NewTTL[int](time.Hour)

	// First 5 pages of group "g" are stored; the 6th is ignored.
	for i := 0; i < 5; i++ {
		if !c.SetBounded("g", string(rune('a'+i)), i, 5) {
			t.Fatalf("page %d should have been stored", i)
		}
	}
	if c.SetBounded("g", "f", 5, 5) {
		t.Fatal("6th page in a full group should be ignored")
	}
	if _, ok := c.Get("f"); ok {
		t.Fatal("ignored page must not be cached")
	}
	if _, ok := c.Get("a"); !ok {
		t.Fatal("first page must stay cached")
	}

	// A different group keeps its own independent budget.
	if !c.SetBounded("other", "x", 1, 5) {
		t.Fatal("a fresh group should accept entries")
	}

	// Re-setting an already-cached key refreshes it without counting against
	// the cap.
	if !c.SetBounded("g", "a", 99, 5) {
		t.Fatal("re-setting an existing key should always succeed")
	}
	if got, _ := c.Get("a"); got != 99 {
		t.Fatalf("expected refreshed value 99, got %d", got)
	}
}

func TestTTLPurgesExpiredOnGrowth(t *testing.T) {
	c := NewTTL[int](-time.Second) // every entry is born expired
	for i := 0; i < purgeThreshold+10; i++ {
		c.Set(string(rune(i)), i)
	}
	// The purge sweep on Set should keep the map from growing without bound.
	c.mu.RLock()
	size := len(c.m)
	c.mu.RUnlock()
	if size > purgeThreshold {
		t.Fatalf("expected expired entries to be swept, size=%d", size)
	}
}
