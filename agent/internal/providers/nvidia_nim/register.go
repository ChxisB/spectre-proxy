// Package nvidia_nim implements the NVIDIA NIM provider.
package nvidia_nim

import (
	"github.com/chrisbeckett/spectre-proxy/agent/internal/providers"
)

func init() {
	providers.RegisterProvider("nvidia_nim", New)
}