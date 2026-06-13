// Package cerebras implements the Cerebras provider.
package cerebras

import (
	"github.com/chrisbeckett/spectre-proxy/agent/internal/providers"
)

func init() {
	providers.RegisterProvider("cerebras", New)
}