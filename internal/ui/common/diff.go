package common

import (
	"github.com/ChxisB/spectre-proxy/internal/ui/diffview"
	"github.com/ChxisB/spectre-proxy/internal/ui/styles"
	"github.com/alecthomas/chroma/v2"
)

// DiffFormatter returns a diff formatter with the given styles that can be
// used to format diff outputs.
func DiffFormatter(s *styles.Styles) *diffview.DiffView {
	formatDiff := diffview.New()
	style := chroma.MustNewStyle("spectre", s.ChromaTheme())
	diff := formatDiff.ChromaStyle(style).Style(s.Diff).TabWidth(4)
	return diff
}
