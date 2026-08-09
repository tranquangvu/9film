package subtitle

import (
	"archive/zip"
	"bytes"
	"strings"
	"testing"
)

func TestParseID(t *testing.T) {
	tests := []struct {
		name          string
		id            string
		provider, ref string
		ok            bool
	}{
		{"subdl", "subdl:/subtitle/3061891-3061999.zip", ProviderSubDL, "/subtitle/3061891-3061999.zip", true},
		{"subdl with episode hint", "subdl:/subtitle/x.zip|S01E02", ProviderSubDL, "/subtitle/x.zip|S01E02", true},
		{"opensubtitles", "opensubtitles:12345", ProviderOpenSubtitles, "12345", true},
		{"legacy bare file id", "12345", ProviderOpenSubtitles, "12345", true},
		{"mixed case prefix", "SubDL:/x.zip", ProviderSubDL, "/x.zip", true},
		{"padded", "  subdl:/x.zip  ", ProviderSubDL, "/x.zip", true},
		{"empty", "", "", "", false},
		{"no ref", "subdl:", "", "", false},
		{"no provider", ":/x.zip", "", "", false},
		{"not an id", "nonsense", "", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider, ref, ok := ParseID(tt.id)
			if ok != tt.ok || provider != tt.provider || ref != tt.ref {
				t.Fatalf("ParseID(%q) = (%q, %q, %v), want (%q, %q, %v)",
					tt.id, provider, ref, ok, tt.provider, tt.ref, tt.ok)
			}
		})
	}
}

func TestSrtToVTT(t *testing.T) {
	srt := "1\r\n00:00:01,000 --> 00:00:02,500\r\nHello\r\n\r\n" +
		"2\r\n00:00:03,000 --> 00:00:04,000\r\nWorld\r\nagain\r\n\r\n" +
		"garbage block without a timestamp\r\n\r\n"

	got := srtToVTT(srt)
	want := "WEBVTT\n\n" +
		"00:00:01.000 --> 00:00:02.500\nHello\n\n" +
		"00:00:03.000 --> 00:00:04.000\nWorld\nagain\n"
	if got != want {
		t.Fatalf("srtToVTT() =\n%q\nwant\n%q", got, want)
	}

	if got := srtToVTT("   \n\n "); got != "WEBVTT\n\n" {
		t.Fatalf("srtToVTT(blank) = %q, want %q", got, "WEBVTT\n\n")
	}
}

func TestToVTT(t *testing.T) {
	// A BOM must not end up in front of the WEBVTT header.
	got, err := toVTT("sub.vtt", []byte("\ufeffWEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n"))
	if err != nil {
		t.Fatalf("toVTT(.vtt): %v", err)
	}
	if !strings.HasPrefix(got, "WEBVTT") {
		t.Fatalf("toVTT(.vtt) = %q, want it to start with WEBVTT", got)
	}

	// A VTT body missing its header gets one.
	got, err = toVTT("sub.vtt", []byte("00:00:01.000 --> 00:00:02.000\nHi\n"))
	if err != nil || !strings.HasPrefix(got, "WEBVTT\n\n") {
		t.Fatalf("toVTT(header-less .vtt) = %q, %v", got, err)
	}

	// Styled formats must fail loudly rather than yield a cue-less VTT.
	if _, err := toVTT("sub.ass", []byte("[Script Info]\n")); err == nil {
		t.Fatal("toVTT(.ass) = nil error, want an unsupported-format error")
	}
}

func TestSubtitleFromArchive(t *testing.T) {
	entries := map[string]string{
		"__MACOSX/._Show.S01E02.srt": "junk",
		"readme.txt":                 "not a subtitle",
		"Show.S01E02.srt":            "short episode two",
		"Show.S01E03.srt":            "much longer episode three body padded out",
	}

	t.Run("hint picks the requested episode", func(t *testing.T) {
		name, data, err := subtitleFromArchive(makeZip(t, entries), "S01E02")
		if err != nil {
			t.Fatalf("subtitleFromArchive: %v", err)
		}
		if name != "Show.S01E02.srt" || string(data) != entries["Show.S01E02.srt"] {
			t.Fatalf("got (%q, %q), want Show.S01E02.srt", name, data)
		}
	})

	t.Run("no hint falls back to the largest subtitle", func(t *testing.T) {
		name, _, err := subtitleFromArchive(makeZip(t, entries), "")
		if err != nil {
			t.Fatalf("subtitleFromArchive: %v", err)
		}
		if name != "Show.S01E03.srt" {
			t.Fatalf("got %q, want Show.S01E03.srt (the largest entry)", name)
		}
	})

	t.Run("archive with no subtitle errors", func(t *testing.T) {
		raw := makeZip(t, map[string]string{"readme.txt": "nothing here"})
		if _, _, err := subtitleFromArchive(raw, ""); err == nil {
			t.Fatal("subtitleFromArchive(junk zip) = nil error, want one")
		}
	})

	t.Run("plain body passes through", func(t *testing.T) {
		name, data, err := subtitleFromArchive([]byte("1\n00:00:01,000 --> 00:00:02,000\nHi\n"), "")
		if err != nil || name != "" || !strings.HasPrefix(string(data), "1\n") {
			t.Fatalf("got (%q, %q, %v), want the body unchanged", name, data, err)
		}
	})
}

func makeZip(t *testing.T, entries map[string]string) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for name, body := range entries {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatalf("zip create %s: %v", name, err)
		}
		if _, err := w.Write([]byte(body)); err != nil {
			t.Fatalf("zip write %s: %v", name, err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("zip close: %v", err)
	}
	return buf.Bytes()
}
