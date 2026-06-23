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
	val   T
	exp   time.Time
	group string // optional bucket for SetBounded's per-group cap; "" for Set
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

// SetBounded stores val under key like Set, but caps the number of live entries
// sharing the same group: once a group already holds max unexpired entries, a
// new key in that group is ignored (existing entries stay). Re-setting a key
// that's already cached always refreshes it and never counts against the cap.
// It bounds high-cardinality keyspaces (e.g. unbounded infinite-scroll cursors
// under one filter combo) without dropping the first, hottest pages. Returns
// whether val was stored.
func (c *TTL[T]) SetBounded(group, key string, val T, max int) bool {
	now := time.Now()
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.m) >= purgeThreshold {
		for k, e := range c.m {
			if now.After(e.exp) {
				delete(c.m, k)
			}
		}
	}
	if _, exists := c.m[key]; !exists {
		live := 0
		for _, e := range c.m {
			if e.group == group && now.Before(e.exp) {
				live++
			}
		}
		if live >= max {
			return false
		}
	}
	c.m[key] = entry[T]{val: val, exp: now.Add(c.ttl), group: group}
	return true
}
