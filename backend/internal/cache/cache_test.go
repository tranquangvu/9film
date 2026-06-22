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
