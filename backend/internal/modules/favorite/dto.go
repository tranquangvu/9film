package favorite

type addFavoriteRequest struct {
	ImdbID    string `json:"imdbId"`
	MediaType string `json:"mediaType"`
}
