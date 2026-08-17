package user

import (
	"strings"
	"testing"
)

func TestKeyHint(t *testing.T) {
	tests := []struct {
		name string
		key  string
		want string
	}{
		{name: "unset", key: "", want: ""},
		{name: "gemini shape", key: "AIzaSyC7xk2L9pQrs0TuVwXyZ1234567890abcde", want: "bcde"},
		{name: "subdl shape", key: "sd-9f2a4c6e8b0d1357", want: "1357"},
		{name: "too short to spare any", key: "abc12345678", want: ""},
		{name: "exactly the minimum", key: "abcdefgh1234", want: "1234"},
		{name: "multi-byte tail stays whole", key: "key-with-emoji-tail-🔑🙂", want: "l-🔑🙂"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := keyHint(tt.key)
			if got != tt.want {
				t.Fatalf("keyHint(%q) = %q, want %q", tt.key, got, tt.want)
			}
			// The hint must never be the key, nor most of it.
			if got != "" && (got == tt.key || len([]rune(got)) > keyHintChars) {
				t.Errorf("hint %q reveals too much of %q", got, tt.key)
			}
		})
	}
}

// The status sent to the client carries the hints and nothing else — a change
// that leaked a whole key into the response would fail here.
func TestStatusOfHidesTheKeys(t *testing.T) {
	c := Credentials{
		GeminiAPIKey: "AIzaSyC7xk2L9pQrs0TuVwXyZ1234567890abcde",
		SubDLAPIKey:  "sd-9f2a4c6e8b0d1357",
	}
	st := (&service{}).statusOf(c)

	if !st.GeminiKeySet || !st.SubDLAPIKeySet {
		t.Fatalf("both keys are set, got %+v", st)
	}
	if st.GeminiKeyHint != "bcde" || st.SubDLAPIKeyHint != "1357" {
		t.Fatalf("unexpected hints: %+v", st)
	}
	for _, key := range []string{c.GeminiAPIKey, c.SubDLAPIKey} {
		for _, hint := range []string{st.GeminiKeyHint, st.SubDLAPIKeyHint} {
			if strings.Contains(key, hint) && len(hint) > keyHintChars {
				t.Errorf("hint %q exposes more than %d characters of %q", hint, keyHintChars, key)
			}
		}
	}
}
