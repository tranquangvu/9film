package stream

type StreamResult struct {
	Body        []byte
	Status      int
	ContentType string
}

type HLSResult struct {
	Body        []byte
	Status      int
	ContentType string
}
