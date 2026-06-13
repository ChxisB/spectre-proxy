// Package codestral implements the Codestral provider.
package codestral

import (
	"github.com/chrisbeckett/spectre-proxy/agent/internal/providers"
)

func init() {
	providers.RegisterProvider("codestral", New)
}