// Package main is the entry point for the spectre Proxy CLI.
//
//	@title			Spectre Proxy API
//	@version		1.0
//	@description	Spectre Proxy is a terminal-based AI coding assistant with multi-provider support. This API is served over a Unix socket (or Windows named pipe) and provides programmatic access to workspaces, sessions, agents, LSP, MCP, and more.
//	@contact.name	Spectre Proxy
//	@contact.url	https://github.com/ChxisB/spectre-proxy
//	@license.name	MIT
//	@license.url	https://github.com/ChxisB/spectre-proxy/blob/main/LICENSE
//	@BasePath		/v1
package main

import (
	"log/slog"
	"net/http"
	_ "net/http/pprof"
	"os"

	"github.com/ChxisB/spectre-proxy/internal/cmd"
	_ "github.com/ChxisB/spectre-proxy/internal/dns"
	_ "github.com/joho/godotenv/autoload"
)

func main() {
	if os.Getenv("SPECTRE_PROFILE") != "" {
		go func() {
			slog.Info("Serving pprof at localhost:6060")
			if httpErr := http.ListenAndServe("localhost:6060", nil); httpErr != nil {
				slog.Error("Failed to pprof listen", "error", httpErr)
			}
		}()
	}

	cmd.Execute()
}
