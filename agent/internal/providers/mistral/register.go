// Package mistral implements the Mistral provider.
package mistral

import (
	"github.com/chrisbeckett/spectre-proxy/agent/internal/providers"
)

func init() {
	providers.RegisterProvider("mistral", New)
}