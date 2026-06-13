// Package fireworks implements the Fireworks provider.
package fireworks

import (
	"github.com/chrisbeckett/spectre-proxy/agent/internal/providers"
)

func init() {
	providers.RegisterProvider("fireworks", New)
}