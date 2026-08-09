package gemini

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// reply serves one canned generateContent response and records what was asked.
func reply(t *testing.T, text string) (*Client, *http.Request, *string) {
	t.Helper()
	var gotReq *http.Request
	var gotBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		gotBody, gotReq = string(body), r
		_, _ = fmt.Fprintf(w, `{"candidates":[{"content":{"parts":[{"text":%s}]}}]}`, mustJSON(t, text))
	}))
	t.Cleanup(srv.Close)

	c := New()
	c.base = srv.URL
	return c, gotReq, &gotBody
}

func mustJSON(t *testing.T, s string) string {
	t.Helper()
	b, err := json.Marshal(s)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return string(b)
}

func TestGenerateSendsKeyAndModel(t *testing.T) {
	c, _, body := reply(t, "hello")

	got, err := c.Generate("k", "gemini-test", "say hi")
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if got != "hello" {
		t.Errorf("Generate() = %q", got)
	}
	if !strings.Contains(*body, "say hi") {
		t.Errorf("prompt not sent: %q", *body)
	}
}

func TestGenerateDefaultsTheModel(t *testing.T) {
	var gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		_, _ = w.Write([]byte(`{"candidates":[]}`))
	}))
	defer srv.Close()

	c := New()
	c.base = srv.URL
	if _, err := c.Generate("k", "", "x"); err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if !strings.Contains(gotPath, DefaultModel) {
		t.Errorf("path = %q, want it to name %s", gotPath, DefaultModel)
	}
}

// Models wrap their answers in prose and code fences however they like, so the
// JSON has to be found inside the reply rather than parsed from the whole of it.
func TestGenerateJSONLooksInsideTheReply(t *testing.T) {
	t.Run("array in a code fence", func(t *testing.T) {
		c, _, _ := reply(t, "Sure!\n```json\n[{\"word\":\"cat\",\"ok\":true}]\n```\nHope that helps.")
		var out []struct {
			Word string `json:"word"`
			OK   bool   `json:"ok"`
		}
		if err := c.GenerateJSONArray("k", "", "p", &out); err != nil {
			t.Fatalf("GenerateJSONArray: %v", err)
		}
		if len(out) != 1 || out[0].Word != "cat" || !out[0].OK {
			t.Fatalf("out = %+v", out)
		}
	})

	t.Run("object with prose around it", func(t *testing.T) {
		c, _, _ := reply(t, "Here you go: {\"meaning\":\"to give up\"} — enjoy.")
		var out struct {
			Meaning string `json:"meaning"`
		}
		if err := c.GenerateJSONObject("k", "", "p", &out); err != nil {
			t.Fatalf("GenerateJSONObject: %v", err)
		}
		if out.Meaning != "to give up" {
			t.Fatalf("out = %+v", out)
		}
	})

	t.Run("no json at all errors", func(t *testing.T) {
		c, _, _ := reply(t, "I'd rather not.")
		var out []string
		if err := c.GenerateJSONArray("k", "", "p", &out); err == nil {
			t.Fatal("GenerateJSONArray() = nil error, want one")
		}
	})
}

func TestGenerateSurfacesHTTPErrors(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte("bad key"))
	}))
	defer srv.Close()

	c := New()
	c.base = srv.URL
	_, err := c.Generate("k", "", "x")
	if err == nil || !strings.Contains(err.Error(), "bad key") {
		t.Fatalf("Generate() error = %v, want it to carry the upstream body", err)
	}
}
