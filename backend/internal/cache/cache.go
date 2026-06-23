// Package cache provides a small, concurrency-safe in-memory cache with
// per-entry TTL expiry. It's used to memoize public, user-independent upstream
// responses (IMDb metadata, stream resolution) so hot paths don't re-hit the
// upstreams on every request.
package cache

import (
	"sync"
	"time"
)

// purgeThreshold is the entry count past which Set opportunistically sweeps
// expired entries, bounding growth for high-cardinality keyspaces (search terms,
// browse param combos) without a background goroutine.
const purgeThreshold = 512

type entry[T any] struct {
	val T
	exp time.Time
}

// TTL is a string-keyed cache whose entries expire after a fixed duration.
type TTL[T any] struct {
	ttl time.Duration
	mu  sync.RWMutex
	m   map[string]entry[T]
}

// NewTTL returns an empty cache whose entries live for ttl.
func NewTTL[T any](ttl time.Duration) *TTL[T] {
	return &TTL[T]{ttl: ttl, m: make(map[string]entry[T])}
}

// Get returns the cached value and true when present and unexpired.
func (c *TTL[T]) Get(key string) (T, bool) {
	c.mu.RLock()
	e, ok := c.m[key]
	c.mu.RUnlock()
	if !ok || time.Now().After(e.exp) {
		var zero T
		return zero, false
	}
	return e.val, true
}

// Set stores val under key with the cache's TTL.
func (c *TTL[T]) Set(key string, val T) {
	now := time.Now()
	c.mu.Lock()
	if len(c.m) >= purgeThreshold {
		for k, e := range c.m {
			if now.After(e.exp) {
				delete(c.m, k)
			}
		}
	}
	c.m[key] = entry[T]{val: val, exp: now.Add(c.ttl)}
	c.mu.Unlock()
}
