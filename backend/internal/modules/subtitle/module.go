package subtitle

import "github.com/gin-gonic/gin"

// Module takes its providers already built, so the vendor clients are chosen in
// the composition root rather than here. The first one is the provider that
// searches; the rest stay reachable for downloads only.
func Module(api *gin.RouterGroup, creds CredsResolver, provs ...Provider) {
	svc := NewSubtitles(creds, provs...)
	RegisterRoutes(api, NewHandler(svc))
}
