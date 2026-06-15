package common

import (
	tea "github.com/ChxisB/spectre-proxy/deps/ui/terminal/v2"
)

// Model represents a common interface for UI components.
type Model[T any] interface {
	Update(msg tea.Msg) (T, tea.Cmd)
	View() string
}
