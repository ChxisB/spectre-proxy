// Package deepseek implements the DeepSeek provider.
package deepseek

import (
	"github.com/chrisbeckett/spectre-proxy/agent/internal/providers"
)

func init() {
	providers.RegisterProvider("deepseek", New)
}