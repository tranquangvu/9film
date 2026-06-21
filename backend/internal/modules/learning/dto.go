package learning

type completeWordRequest struct {
	Word string `json:"word"`
}

// reviewRequest grades one due word in a review session. Grade ∈ again|hard|good|easy.
type reviewRequest struct {
	Word  string `json:"word"`
	Grade string `json:"grade"`
}

type importRequest struct {
	List string `json:"list"`
}

// submitTestRequest is the client payload for a completed self-test: the words
// of one completed-date group, each with the retyped spellings + a meaning.
type submitTestRequest struct {
	List       string `json:"list"`
	GroupLabel string `json:"groupLabel"`
	Items      []struct {
		Word      string   `json:"word"`
		Spellings []string `json:"spellings"`
		Meaning   string   `json:"meaning"`
	} `json:"items"`
}
