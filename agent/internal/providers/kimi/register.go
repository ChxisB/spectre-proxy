// Package kimi implements the Kimi provider.
package kimi

import (
	"github.com/chrisbeckett/spectre-proxy/agent/internal/providers"
)

func init() {
	providers.RegisterProvider("kimi", New)
}