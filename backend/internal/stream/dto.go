package stream

import "io"

type StreamResult struct {
	Body        []byte
	Status      int
	ContentType string
}

// HLSResult carries a proxied HLS response. Manifests are rewritten and returned
// in Body. Segments (and any other non-manifest body) are left untouched and
// exposed as Body (the rewritten manifest) OR Stream (the upstream body to copy
// through without buffering) — exactly one is set. When Stream is non-nil the
// caller must Close it after copying.
type HLSResult struct {
	Body        []byte
	Stream      io.ReadCloser
	Status      int
	ContentType string
}
