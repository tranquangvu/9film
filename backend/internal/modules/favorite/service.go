package favorite

type Service interface {
	Favorites(userID int64) ([]Favorite, error)
	AddFavorite(userID int64, imdbID, mediaType string) error
	RemoveFavorite(userID int64, imdbID string) error
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) Favorites(userID int64) ([]Favorite, error) {
	return s.repo.Favorites(userID)
}

func (s *service) AddFavorite(userID int64, imdbID, mediaType string) error {
	return s.repo.AddFavorite(userID, imdbID, mediaType)
}

func (s *service) RemoveFavorite(userID int64, imdbID string) error {
	return s.repo.RemoveFavorite(userID, imdbID)
}
