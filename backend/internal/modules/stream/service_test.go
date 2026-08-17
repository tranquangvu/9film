package stream

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// testHLS builds an HLS proxy pointed at a test server, with the retry backoff
// collapsed so the tests don't sleep.
func testHLS() *hls {
	return &hls{
		client:  &http.Client{},
		referer: &refererResolver{value: embedRefererDefault},
	}
}

func TestProxyHLSRetriesTransientUpstream(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
		w.Write([]byte("#EXTM3U\nseg1.ts\n"))
	}))
	defer srv.Close()

	result, err := testHLS().ProxyHLS(context.Background(), srv.URL+"/index.m3u8")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != http.StatusOK {
		t.Fatalf("got status %d, want 200", result.Status)
	}
	if got := calls.Load(); got != 2 {
		t.Errorf("upstream called %d times, want 2", got)
	}
	if !strings.Contains(string(result.Body), "/hls?url=") {
		t.Errorf("manifest not rewritten: %q", result.Body)
	}
}

func TestProxyHLSPassesThroughFinalUpstreamStatus(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	result, err := testHLS().ProxyHLS(context.Background(), srv.URL+"/seg1.ts")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer result.Stream.Close()
	if result.Status != http.StatusServiceUnavailable {
		t.Fatalf("got status %d, want 503", result.Status)
	}
	if got := calls.Load(); got != hlsAttempts {
		t.Errorf("upstream called %d times, want %d", got, hlsAttempts)
	}
}

func TestProxyHLSDoesNotRetryAfterClientCancel(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		<-r.Context().Done()
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	if _, err := testHLS().ProxyHLS(ctx, srv.URL+"/index.m3u8"); err == nil {
		t.Fatal("expected an error after cancellation")
	}
	if got := calls.Load(); got != 1 {
		t.Errorf("upstream called %d times, want 1", got)
	}
}

func TestProxyHLSDoesNotRetryNotFound(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	result, err := testHLS().ProxyHLS(context.Background(), srv.URL+"/seg1.ts")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer result.Stream.Close()
	if got := calls.Load(); got != 1 {
		t.Errorf("upstream called %d times, want 1", got)
	}
}

func TestRefererFromHTML(t *testing.T) {
	tests := []struct {
		name    string
		html    string
		want    string
		wantErr bool
	}{
		{
			name: "real embed shape",
			html: `<html><body><iframe id="pf" src="https://nextgencloudfabric.com/embed/movie/tt0371746" allowfullscreen></iframe></body></html>`,
			want: "https://nextgencloudfabric.com/",
		},
		{
			name: "first iframe wins",
			html: `<iframe src="https://a.example/x"></iframe><iframe src="https://b.example/y"></iframe>`,
			want: "https://a.example/",
		},
		{
			name: "single quotes and attrs before src",
			html: `<iframe width='100%' class="player" src='http://host.tld/embed?id=1'></iframe>`,
			want: "http://host.tld/",
		},
		{
			name:    "no iframe",
			html:    `<html><body>nothing here</body></html>`,
			wantErr: true,
		},
		{
			name:    "relative src has no host",
			html:    `<iframe src="/embed/movie/tt1"></iframe>`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := refererFromHTML([]byte(tt.html))
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got %q", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}
