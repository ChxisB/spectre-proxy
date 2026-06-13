// Package logger provides structured file-based logging for the Spectre Proxy proxy.
// Logs are written to ~/.claude/logs/ split by day.
package logger

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

var (
	logDir  string
	logFile string
	mu      sync.Mutex
)

func init() {
	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	logDir = filepath.Join(home, ".claude", "logs")
	os.MkdirAll(logDir, 0755)
}

// getLogFile returns the log file path for the current day.
func getLogFile() string {
	today := time.Now().UTC().Format("2006-01-02")
	return filepath.Join(logDir, "proxy-"+today+".jsonl")
}

// LogEntry represents a single structured log entry.
type LogEntry struct {
	Timestamp string         `json:"timestamp"`
	Level     string         `json:"level"`
	Provider  string         `json:"provider,omitempty"`
	Model     string         `json:"model,omitempty"`
	Direction string         `json:"direction,omitempty"` // "request" or "response"
	Message   string         `json:"message,omitempty"`
	Error     string         `json:"error,omitempty"`
	Data      map[string]any `json:"data,omitempty"`
}

// Log writes a structured log entry to the daily log file.
func Log(level, provider, model, direction, message, errMsg string, data map[string]any) {
	entry := LogEntry{
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		Level:     level,
		Provider:  provider,
		Model:     model,
		Direction: direction,
		Message:   message,
		Error:     errMsg,
		Data:      data,
	}

	b, err := json.Marshal(entry)
	if err != nil {
		return
	}

	mu.Lock()
	defer mu.Unlock()

	f, err := os.OpenFile(getLogFile(), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()

	f.Write(b)
	f.Write([]byte("\n"))
}

// LogRequest logs an outgoing request to a provider.
func LogRequest(provider, model string, data map[string]any) {
	Log("info", provider, model, "request", "", "", data)
}

// LogResponse logs an incoming response from a provider.
func LogResponse(provider, model string, data map[string]any) {
	Log("info", provider, model, "response", "", "", data)
}

// LogError logs an error from a provider.
func LogError(provider, model, errMsg string, data map[string]any) {
	Log("error", provider, model, "response", "", errMsg, data)
}

// LogDebug logs a debug message.
func LogDebug(provider, model, message string) {
	Log("debug", provider, model, "", message, "", nil)
}

// Printf prints to stdout AND logs to file.
func Printf(provider, format string, args ...any) {
	msg := fmt.Sprintf(format, args...)
	fmt.Println(msg)
	Log("info", provider, "", "", msg, "", nil)
}
