package handler

import (
	"errors"
	"net/http"
	"net/url"
	"strings"

	"github.com/bentran/nicefilm/backend/internal/auth"
	"github.com/bentran/nicefilm/backend/internal/config"
	"github.com/bentran/nicefilm/backend/internal/logger"
	"github.com/bentran/nicefilm/backend/internal/store"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// AuthHandler serves signup/login. It needs the store (user lookups) and config
// (JWT signing secret + TTL).
type AuthHandler struct {
	store *store.Store
	cfg   *config.Config
}

func NewAuthHandler(st *store.Store, cfg *config.Config) *AuthHandler {
	return &AuthHandler{store: st, cfg: cfg}
}

type signupRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func avatarFor(email string) string {
	return "https://api.dicebear.com/7.x/avataaars/svg?seed=" + url.QueryEscape(email)
}

func (h *AuthHandler) issueAndRespond(c *gin.Context, u *store.User, status int) {
	token, err := auth.Issue(u.ID, h.cfg.JWTSecret, h.cfg.TokenTTL)
	if err != nil {
		logger.Get().Error("jwt issue failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not issue token"})
		return
	}
	c.JSON(status, gin.H{"token": token, "user": u})
}

// Signup creates a new account and returns a token.
func (h *AuthHandler) Signup(c *gin.Context) {
	var req signupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	name := strings.TrimSpace(req.Name)
	if email == "" || !strings.Contains(email, "@") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a valid email is required"})
		return
	}
	if len(req.Password) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password must be at least 6 characters"})
		return
	}
	if name == "" {
		name = strings.SplitN(email, "@", 2)[0]
	}

	if _, err := h.store.GetUserByEmail(email); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "an account with that email already exists"})
		return
	} else if !errors.Is(err, store.ErrNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not check account"})
		return
	}

	hash, err := auth.Hash(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash password"})
		return
	}

	u, err := h.store.CreateUser(email, hash, name, avatarFor(email))
	if err != nil {
		logger.Get().Warn("create user failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create account"})
		return
	}
	h.issueAndRespond(c, u, http.StatusCreated)
}

// Login verifies credentials and returns a token.
func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))

	u, err := h.store.GetUserByEmail(email)
	if err != nil || !auth.Verify(u.PasswordHash, req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}
	h.issueAndRespond(c, u, http.StatusOK)
}
