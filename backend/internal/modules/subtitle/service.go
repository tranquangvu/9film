package subtitle

import (
	"errors"
	"fmt"

	"github.com/bentran/nicefilm/backend/internal/logger"
	"go.uber.org/zap"
)

// Subtitles resolves per-user credentials and dispatches to a provider. Search
// always goes to the active provider; download follows the provider named in the
// id, so a track picked before the server switched providers still plays.
type Subtitles interface {
	Configured(userID int64) bool
	ActiveName() string
	Search(userID int64, params SubtitleSearchParams) ([]SubtitleOption, error)
	DownloadVTT(userID int64, id string) (string, error)
}

type subtitles struct {
	active    Provider
	providers map[string]Provider
	creds     CredsResolver
}

// NewSubtitles registers every compiled-in provider and marks `active` (from
// SUBTITLE_PROVIDER) as the one search uses. An unknown name falls back to the
// first provider passed rather than failing the boot on a typo in .env.
func NewSubtitles(active string, creds CredsResolver, provs ...Provider) Subtitles {
	s := &subtitles{providers: make(map[string]Provider, len(provs)), creds: creds}
	for _, p := range provs {
		s.providers[p.Name()] = p
	}
	s.active = s.providers[active]
	if s.active == nil {
		s.active = provs[0]
		logger.Get().Warn("unknown subtitle provider, falling back",
			zap.String("requested", active), zap.String("using", s.active.Name()))
	}
	return s
}

func (s *subtitles) ActiveName() string { return s.active.Name() }

func (s *subtitles) Configured(userID int64) bool {
	return s.creds.For(s.active.Name(), userID).Configured()
}

func (s *subtitles) Search(userID int64, params SubtitleSearchParams) ([]SubtitleOption, error) {
	creds := s.creds.For(s.active.Name(), userID)
	if !creds.Configured() {
		return nil, ErrNotConfigured
	}
	return s.active.Search(creds, params)
}

func (s *subtitles) DownloadVTT(userID int64, id string) (string, error) {
	name, ref, ok := ParseID(id)
	if !ok {
		return "", fmt.Errorf("%w: malformed subtitle id %q", ErrUnknownProvider, id)
	}
	p := s.providers[name]
	if p == nil {
		return "", fmt.Errorf("%w: %q", ErrUnknownProvider, name)
	}

	creds := s.creds.For(name, userID)
	if !creds.Configured() {
		return "", fmt.Errorf("%w: %s", ErrNotConfigured, providerLabel(name))
	}

	vtt, err := p.DownloadVTT(creds, ref)
	if err != nil {
		// Only the shared .env account being throttled is worth a special nudge —
		// the user can fix that by adding their own key.
		if creds.Shared && errors.Is(err, ErrRateLimited) {
			return "", fmt.Errorf("%w: %w", ErrSharedRateLimited, err)
		}
		return "", err
	}
	return vtt, nil
}
