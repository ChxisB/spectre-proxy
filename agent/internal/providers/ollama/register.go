// Package ollama implements the Ollama provider.
package ollama

import (
	"github.com/chrisbeckett/spectre-proxy/agent/internal/providers"
)

func init() {
	providers.RegisterProvider("ollama", New)
}