// Package llamacpp implements the llama.cpp provider.
package llamacpp

import (
	"github.com/chrisbeckett/spectre-proxy/agent/internal/providers"
)

func init() {
	providers.RegisterProvider("llamacpp", New)
}