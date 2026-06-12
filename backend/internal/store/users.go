package store

import (
	"database/sql"
	"errors"
)

var ErrNotFound = errors.New("not found")

type User struct {
	ID           int64  `json:"id"`
	Email        string `json:"email"`
	PasswordHash string `json:"-"`
	Name         string `json:"name"`
	Avatar       string `json:"avatar"`
	Plan         string `json:"plan"`
	CreatedAt    string `json:"createdAt"`
}

// CreateUser inserts a new user and returns it with its assigned id.
// The caller is responsible for hashing the password.
func (s *Store) CreateUser(email, passwordHash, name, avatar string) (*User, error) {
	res, err := s.db.Exec(
		`INSERT INTO users (email, password_hash, name, avatar) VALUES (?, ?, ?, ?)`,
		email, passwordHash, name, avatar,
	)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	return s.GetUserByID(id)
}

func (s *Store) GetUserByEmail(email string) (*User, error) {
	return s.scanUser(s.db.QueryRow(
		`SELECT id, email, password_hash, name, avatar, plan, created_at FROM users WHERE email = ?`,
		email,
	))
}

func (s *Store) GetUserByID(id int64) (*User, error) {
	return s.scanUser(s.db.QueryRow(
		`SELECT id, email, password_hash, name, avatar, plan, created_at FROM users WHERE id = ?`,
		id,
	))
}

func (s *Store) scanUser(row *sql.Row) (*User, error) {
	var u User
	var avatar sql.NullString
	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &avatar, &u.Plan, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	u.Avatar = avatar.String
	return &u, nil
}
