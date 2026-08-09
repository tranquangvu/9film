package subtitle

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/bentran/nicefilm/backend/internal/clients/opensubtitles"
)

// OpenSubtitles was the original subtitle source. It is NOT wired into the app:
// Module registers SubDL alone, nothing calls NewOpenSubtitles, and no
// credentials reach it — an "opensubtitles:" id returns "unknown provider".
//
// This adapter and the client in clients/opensubtitles are kept whole and
// compiling so they don't rot. Wiring it back in takes three steps:
//  1. pass NewOpenSubtitles(opensubtitles.New()) to subtitle.Module in app.go
//     (first in the list if it should be the one that searches),
//  2. give subtitleCreds in app.go an opensubtitles case, which means restoring
//     the key/username/password on user.Credentials and the credentials table,
//  3. re-expose those fields in the profile Connections form.

// osAPI is the slice of the OpenSubtitles client this adapter uses, named here so
// the adapter can be tested against a stub instead of the network.
type osAPI interface {
	Search(creds opensubtitles.Credentials, p opensubtitles.SearchParams) ([]opensubtitles.Subtitle, error)
	Download(creds opensubtitles.Credentials, fileID int) (data []byte, filename string, err error)
}

type osProvider struct{ api osAPI }

func NewOpenSubtitles(api osAPI) Provider { return &osProvider{api: api} }

func (p *osProvider) Name() string { return ProviderOpenSubtitles }

func (p *osProvider) Search(creds Creds, params SubtitleSearchParams) ([]SubtitleOption, error) {
	subs, err := p.api.Search(osCreds(creds), opensubtitles.SearchParams{
		IMDbID:    params.IMDbID,
		TMDbID:    params.TMDbID,
		MediaType: params.MediaType,
		Season:    params.Season,
		Episode:   params.Episode,
		Languages: params.Languages,
	})
	if err != nil {
		return nil, rateLimited(err, opensubtitles.ErrRateLimited)
	}

	options := make([]SubtitleOption, 0, len(subs))
	for _, s := range subs {
		lang := s.Language
		if lang == "" {
			lang = "und"
		}
		label := strings.ToUpper(lang)
		if s.Release != "" {
			label = label + " — " + s.Release
		}
		options = append(options, SubtitleOption{
			ID:            FormatID(ProviderOpenSubtitles, strconv.Itoa(s.FileID)),
			Language:      lang,
			Label:         label,
			DownloadCount: s.DownloadCount,
			Release:       s.Release,
		})
	}
	return options, nil
}

// DownloadVTT takes an OpenSubtitles file id as its ref.
func (p *osProvider) DownloadVTT(creds Creds, ref string) (string, error) {
	fileID, err := strconv.Atoi(ref)
	if err != nil || fileID <= 0 {
		return "", fmt.Errorf("invalid OpenSubtitles file id %q", ref)
	}

	raw, filename, err := p.api.Download(osCreds(creds), fileID)
	if err != nil {
		return "", rateLimited(err, opensubtitles.ErrRateLimited)
	}
	name, data, err := subtitleFromArchive(raw, "")
	if err != nil {
		return "", err
	}
	if name == "" {
		// A plain (or header-less gzip) body: the link's own filename decides
		// whether this is already VTT.
		name = filename
	}
	return toVTT(name, data)
}

func osCreds(c Creds) opensubtitles.Credentials {
	return opensubtitles.Credentials{APIKey: c.APIKey, Username: c.Username, Password: c.Password}
}
