package stream

import "testing"

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
