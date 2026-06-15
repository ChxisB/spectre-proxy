package diffview

import (
	lipgloss "github.com/ChxisB/spectre-proxy/deps/style/v2"
	"github.com/ChxisB/spectre-proxy/deps/util/exp/palette"
)

// LineStyle defines the styles for a given line type in the diff view.
type LineStyle struct {
	LineNumber lipgloss.Style
	Symbol     lipgloss.Style
	Code       lipgloss.Style
}

// Style defines the overall style for the diff view, including styles for
// different line types such as divider, missing, equal, insert, and delete
// lines.
type Style struct {
	DividerLine LineStyle
	MissingLine LineStyle
	EqualLine   LineStyle
	InsertLine  LineStyle
	DeleteLine  LineStyle
	Filename    LineStyle
}

// DefaultLightStyle provides a default light theme style for the diff view.
func DefaultLightStyle() Style {
	return Style{
		DividerLine: LineStyle{
			LineNumber: lipgloss.NewStyle().
				Foreground(palette.Iron).
				Background(palette.Thunder),
			Code: lipgloss.NewStyle().
				Foreground(palette.Oyster).
				Background(palette.Anchovy),
		},
		MissingLine: LineStyle{
			LineNumber: lipgloss.NewStyle().
				Background(palette.Sash),
			Code: lipgloss.NewStyle().
				Background(palette.Sash),
		},
		EqualLine: LineStyle{
			LineNumber: lipgloss.NewStyle().
				Foreground(palette.Char).
				Background(palette.Sash),
			Code: lipgloss.NewStyle().
				Foreground(palette.Pepper).
				Background(palette.Salt),
		},
		InsertLine: LineStyle{
			LineNumber: lipgloss.NewStyle().
				Foreground(palette.Turtle).
				Background(lipgloss.Color("#c8e6c9")),
			Symbol: lipgloss.NewStyle().
				Foreground(palette.Turtle).
				Background(lipgloss.Color("#e8f5e9")),
			Code: lipgloss.NewStyle().
				Foreground(palette.Pepper).
				Background(lipgloss.Color("#e8f5e9")),
		},
		DeleteLine: LineStyle{
			LineNumber: lipgloss.NewStyle().
				Foreground(palette.Cherry).
				Background(lipgloss.Color("#ffcdd2")),
			Symbol: lipgloss.NewStyle().
				Foreground(palette.Cherry).
				Background(lipgloss.Color("#ffebee")),
			Code: lipgloss.NewStyle().
				Foreground(palette.Pepper).
				Background(lipgloss.Color("#ffebee")),
		},
		Filename: LineStyle{
			LineNumber: lipgloss.NewStyle().
				Foreground(palette.Iron).
				Background(palette.Thunder),
			Code: lipgloss.NewStyle().
				Foreground(palette.Iron).
				Background(palette.Thunder),
		},
	}
}

// DefaultDarkStyle provides a default dark theme style for the diff view.
func DefaultDarkStyle() Style {
	return Style{
		DividerLine: LineStyle{
			LineNumber: lipgloss.NewStyle().
				Foreground(palette.Smoke).
				Background(palette.Sapphire),
			Code: lipgloss.NewStyle().
				Foreground(palette.Smoke).
				Background(palette.Ox),
		},
		MissingLine: LineStyle{
			LineNumber: lipgloss.NewStyle().
				Background(palette.Char),
			Code: lipgloss.NewStyle().
				Background(palette.Char),
		},
		EqualLine: LineStyle{
			LineNumber: lipgloss.NewStyle().
				Foreground(palette.Sash).
				Background(palette.Char),
			Code: lipgloss.NewStyle().
				Foreground(palette.Salt).
				Background(palette.Pepper),
		},
		InsertLine: LineStyle{
			LineNumber: lipgloss.NewStyle().
				Foreground(palette.Turtle).
				Background(lipgloss.Color("#293229")),
			Symbol: lipgloss.NewStyle().
				Foreground(palette.Turtle).
				Background(lipgloss.Color("#303a30")),
			Code: lipgloss.NewStyle().
				Foreground(palette.Salt).
				Background(lipgloss.Color("#303a30")),
		},
		DeleteLine: LineStyle{
			LineNumber: lipgloss.NewStyle().
				Foreground(palette.Cherry).
				Background(lipgloss.Color("#332929")),
			Symbol: lipgloss.NewStyle().
				Foreground(palette.Cherry).
				Background(lipgloss.Color("#3a3030")),
			Code: lipgloss.NewStyle().
				Foreground(palette.Salt).
				Background(lipgloss.Color("#3a3030")),
		},
		Filename: LineStyle{
			LineNumber: lipgloss.NewStyle().
				Foreground(palette.Smoke).
				Background(palette.Sapphire),
			Code: lipgloss.NewStyle().
				Foreground(palette.Smoke).
				Background(palette.Sapphire),
		},
	}
}
