// Package lmstudio implements the LM Studio provider.
package lmstudio

import (
	"github.com/chrisbeckett/spectre-proxy/agent/internal/providers"
)

func init() {
	providers.RegisterProvider("lmstudio", New)
}