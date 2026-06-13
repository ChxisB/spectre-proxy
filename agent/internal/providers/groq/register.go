// Package groq implements the Groq provider.
package groq

import (
	"github.com/chrisbeckett/spectre-proxy/agent/internal/providers"
)

func init() {
	providers.RegisterProvider("groq", New)
}