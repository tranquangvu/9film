package user

import "github.com/gin-gonic/gin"

// The /me routes address the local account; middleware.LocalUser (mounted on
// the whole /api group) is what puts its id in the context.
func RegisterRoutes(rg *gin.RouterGroup, h *Handler) {
	me := rg.Group("/me")
	me.GET("", h.GetMe)
	me.PUT("", h.UpdateMe)
	me.GET("/settings", h.GetSettings)
	me.PUT("/settings", h.PutSettings)
	me.GET("/credentials", h.GetCredentials)
	me.PUT("/credentials", h.PutCredentials)
}
