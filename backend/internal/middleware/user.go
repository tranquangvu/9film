// Package middleware holds the gin middleware shared by every route: request
// logging, panic recovery, CORS, and the local-user identity below.
package middleware

import "github.com/gin-gonic/gin"

const userIDKey = "userID"

// LocalUser stamps every request with the single local account's id.
//
// There is no sign-in: this app runs on one person's machine against a SQLite
// file, so whoever can reach the port is that person. The user id stays in the
// gin context (rather than being dropped from the modules entirely) because it
// is still the key of every row in the database — handlers and repositories are
// unchanged by the absence of auth, and re-introducing real accounts later means
// swapping this one middleware.
func LocalUser(id int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(userIDKey, id)
		c.Next()
	}
}

// UserID returns the local user id stamped by LocalUser (0 if the middleware
// isn't mounted on the route).
func UserID(c *gin.Context) int64 {
	v, _ := c.Get(userIDKey)
	id, _ := v.(int64)
	return id
}
