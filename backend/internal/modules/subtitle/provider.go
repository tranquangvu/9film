package subtitle

import (
	"errors"
	"fmt"
	"strings"
)

// The subtitle sources this package knows how to name. Only SubDL is wired into
// the app (see Module); ProviderOpenSubtitles stays here because opensubtitles.go
// still compiles against it and because ids minted before it was unwired are
// still in the database.
const (
	ProviderSubDL         = "subdl"
	ProviderOpenSubtitles = "opensubtitles"
)

// Creds are one provider's credentials for one request, resolved per-user (the
// user's own keys, or the .env fallback) by the composition root. Username and
// Password are OpenSubtitles-only — SubDL authenticates with the API key alone —
// so nothing populates them while OpenSubtitles is unwired.
type Creds struct {
	APIKey   string
	Username string
	Password string
	// Shared is true when these came from the server's .env fallback rather than
	// the user's own stored keys — used to nudge the user to add their own when
	// the shared account gets rate-limited.
	Shared bool
}

func (c Creds) Configured() bool { return c.APIKey != "" }

// CredsResolver returns the credentials to use for one provider and user. It is
// keyed by provider (not just user) because a preference saved under a previous
// provider must keep downloading while a different one is active.
type CredsResolver interface {
	For(provider string, userID int64) Creds
}

// Provider is one subtitle source. Implementations own their HTTP client and any
// provider-internal cache (e.g. the OpenSubtitles auth token) and are safe for
// concurrent use.
type Provider interface {
	// Name is the prefix in the opaque "<provider>:<ref>" subtitle id.
	Name() string
	// Search returns normalized options whose ID is already "<name>:<ref>", in the
	// provider's own most-relevant-first order.
	Search(creds Creds, params SubtitleSearchParams) ([]SubtitleOption, error)
	// DownloadVTT fetches the subtitle behind a provider-specific ref (everything
	// after "<name>:") and returns WebVTT text.
	DownloadVTT(creds Creds, ref string) (string, error)
}

var (
	// ErrRateLimited is returned when a provider rejects a request because the
	// account hit its rate limit or exhausted its download quota.
	ErrRateLimited = errors.New("subtitle provider rate limit reached or download quota exceeded")
	// ErrSharedRateLimited wraps ErrRateLimited when the throttled account is the
	// shared .env one, so the handler can nudge the user to add their own key.
	ErrSharedRateLimited = errors.New("shared subtitle account rate limited")
	ErrUnknownProvider   = errors.New("unknown subtitle provider")
	ErrNotConfigured     = errors.New("subtitle provider not configured")
)

// rateLimited restates a client's own throttling error — passed as limit, e.g.
// subdl.ErrRateLimited — in this package's vocabulary, which is what the handler
// matches on to decide between a plain error and the "add your own key" nudge.
// Taking the sentinel as an argument keeps each adapter naming its own vendor's
// error instead of this helper growing a case per provider.
func rateLimited(err, limit error) error {
	if errors.Is(err, limit) {
		return fmt.Errorf("%w: %w", ErrRateLimited, err)
	}
	return err
}

// FormatID builds the opaque subtitle id handed to the frontend and stored in
// watch history. Refs are provider-private: an OpenSubtitles file id, a SubDL
// archive path — nothing above this package parses them.
func FormatID(provider, ref string) string { return provider + ":" + ref }

// ParseID splits an opaque "<provider>:<ref>" id on its first colon (refs may
// contain colons of their own). A bare numeric id is read as a legacy
// OpenSubtitles file id: that provider is no longer wired in, so such an id now
// resolves to a clean "unknown provider" error instead of being mistaken for a
// SubDL ref.
func ParseID(id string) (provider, ref string, ok bool) {
	id = strings.TrimSpace(id)
	if id == "" {
		return "", "", false
	}
	name, rest, found := strings.Cut(id, ":")
	if !found {
		if isDigits(id) {
			return ProviderOpenSubtitles, id, true
		}
		return "", "", false
	}
	if name == "" || rest == "" {
		return "", "", false
	}
	return strings.ToLower(name), rest, true
}

func isDigits(s string) bool {
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

// providerLabel is the human-facing name used in error copy.
func providerLabel(name string) string {
	switch name {
	case ProviderSubDL:
		return "SubDL"
	case ProviderOpenSubtitles:
		return "OpenSubtitles"
	default:
		return name
	}
}
