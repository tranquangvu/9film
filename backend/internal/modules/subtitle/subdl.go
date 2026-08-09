package subtitle

import (
	"errors"
	"fmt"
	"strings"

	"github.com/bentran/nicefilm/backend/internal/httpx"
	"github.com/bentran/nicefilm/backend/internal/providers/subdl"
)

// subdlAPI is the slice of the SubDL client this adapter uses, named here so the
// adapter can be tested against a stub instead of the network.
type subdlAPI interface {
	Search(apiKey string, p subdl.SearchParams) ([]subdl.Subtitle, error)
	Download(apiKey, archivePath string) ([]byte, error)
}

// subdlProvider adapts the SubDL client to Provider: it mints the opaque ids the
// rest of the app passes around, builds the human-facing labels, and turns a
// downloaded archive into WebVTT. Everything vendor-specific stays in the client.
type subdlProvider struct{ api subdlAPI }

// NewSubDL wires the SubDL client into the Provider contract. The composition
// root builds the client, so nothing in this package reaches the network on its
// own.
func NewSubDL(api subdlAPI) Provider { return &subdlProvider{api: api} }

func (p *subdlProvider) Name() string { return ProviderSubDL }

func (p *subdlProvider) Search(creds Creds, params SubtitleSearchParams) ([]SubtitleOption, error) {
	subs, err := p.api.Search(creds.APIKey, subdl.SearchParams{
		IMDbID:    params.IMDbID,
		TMDbID:    params.TMDbID,
		MediaType: params.MediaType,
		Season:    params.Season,
		Episode:   params.Episode,
		Languages: params.Languages,
	})
	if err != nil {
		return nil, rateLimited(err)
	}

	options := make([]SubtitleOption, 0, len(subs))
	for _, s := range subs {
		release := s.ReleaseName
		if release == "" {
			release = s.Name
		}
		// Lowercased to match <track srclang> and the frontend's preferred-language
		// prefix test. SubDL's regional codes (BR_PT, ZH_BG) aren't ISO, but they
		// only ever have to compare equal to themselves.
		lang := strings.ToLower(s.Language)
		if lang == "" {
			lang = "und"
		}
		label := strings.ToUpper(lang)
		if release != "" {
			label += " — " + release
		}
		if s.HI {
			label += " (HI)"
		}
		options = append(options, SubtitleOption{
			ID:       FormatID(ProviderSubDL, subdlRef(s.Path, params)),
			Language: lang,
			Label:    label,
			Release:  release,
			// SubDL publishes no download count — see SubtitleOption.
		})
	}
	return options, nil
}

// DownloadVTT takes "<archive path>[|SxxEyy]" as its ref — see subdlRef.
func (p *subdlProvider) DownloadVTT(creds Creds, ref string) (string, error) {
	archivePath, hint, _ := strings.Cut(ref, "|")
	if archivePath == "" {
		return "", fmt.Errorf("invalid SubDL subtitle ref %q", ref)
	}

	raw, err := p.api.Download(creds.APIKey, archivePath)
	if err != nil {
		return "", rateLimited(err)
	}
	name, data, err := subtitleFromArchive(raw, hint)
	if err != nil {
		return "", fmt.Errorf("SubDL download: %w", err)
	}
	return toVTT(name, data)
}

// subdlRef pins the requested episode to the archive path. SubDL returns whole
// season packs alongside per-episode subtitles, and a pack's ZIP holds one file
// per episode — the path alone can't say which. '|' can't appear in a SubDL path
// and doesn't collide with the ':' that ParseID splits on, so the ref stays
// opaque to everything above this provider.
func subdlRef(archivePath string, p SubtitleSearchParams) string {
	if p.MediaType == "tv" && p.Season != nil && p.Episode != nil {
		return fmt.Sprintf("%s|S%02dE%02d", archivePath, *p.Season, *p.Episode)
	}
	return archivePath
}

// rateLimited restates a client's throttling error in this package's vocabulary,
// which is what the handler matches on to decide between a plain error and the
// "add your own key" nudge.
func rateLimited(err error) error {
	if errors.Is(err, httpx.ErrRateLimited) {
		return fmt.Errorf("%w: %w", ErrRateLimited, err)
	}
	return err
}
