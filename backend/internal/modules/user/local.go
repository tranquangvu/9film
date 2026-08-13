package user

import (
	"database/sql"
	"errors"
)

// localUsername is the account this app runs as — the one database.Open seeds.
// Changing it means adding a rename statement to database.Migrate alongside the
// seed, or the next boot lands in a fresh empty account.
const localUsername = "9film"

// LocalUserID returns the id of the single account this app runs as, creating it
// if the database has none.
//
// There is no sign-in (see middleware.LocalUser), so the composition root calls
// this once at startup and every request is stamped with the result. It matches
// on the username rather than taking the lowest id because a database from
// before auth was removed can hold several accounts, and the seeded one is not
// necessarily the oldest — picking by id would silently switch to a stale
// account's history and stored keys.
//
// It takes the database rather than hanging off Service because it runs before
// any of this module is wired: app.go needs the id to mount middleware.LocalUser
// on the /api group, which has to happen before Module registers a single route.
func LocalUserID(db *sql.DB) (int64, error) {
	repo := NewRepository(db)

	u, err := repo.GetUserByUsername(localUsername)
	if err == nil {
		return u.ID, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return 0, err
	}

	u, err = repo.CreateUser(localUsername, avatarFor(localUsername))
	if err != nil {
		return 0, err
	}
	return u.ID, nil
}
