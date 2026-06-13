// Package wafer implements the Wafer provider.
package wafer

import (
	"github.com/chrisbeckett/spectre-proxy/agent/internal/providers"
)

func init() {
	providers.RegisterProvider("wafer", New)
}