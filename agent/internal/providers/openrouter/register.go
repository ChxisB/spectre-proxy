// Package openrouter implements the OpenRouter provider.
package openrouter

import (
	"github.com/chrisbeckett/spectre-proxy/agent/internal/providers"
)

func init() {
	providers.RegisterProvider("open_router", New)
}