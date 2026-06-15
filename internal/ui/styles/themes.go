package styles

import (
	"image/color"

	"github.com/ChxisB/spectre-proxy/deps/util/exp/palette"
)

// ThemeForProvider returns the Styles associated with the given provider
// ID. Unknown or empty provider IDs yield the default Default Pantera
// theme.
func ThemeForProvider(providerID string) Styles {
	switch providerID {
	case "hyper":
		return HyperSpectreObsidiana()
	default:
		return DefaultPantera()
	}
}

// Default themePantera returns the Default dark theme. It's the default style
// for the UI.
func DefaultPantera() Styles {
	return quickStyle(quickStyleOpts{
		primary:   color.RGBA{0x8b, 0x5c, 0xf6, 0xff}, // purple (dashboard accent)
		secondary: color.RGBA{0x0e, 0xa5, 0x6e, 0xff}, // green (terminal green)
		accent:    palette.Bok,

		fgBase:       palette.Sash,
		fgMoreSubtle: palette.Squid,
		fgSubtle:     palette.Smoke,
		fgMostSubtle: palette.Oyster,

		onPrimary: palette.Butter,

		bgBase:         palette.Pepper,
		bgLeastVisible: palette.BBQ,
		bgLessVisible:  palette.Char,
		bgMostVisible:  palette.Iron,

		separator: palette.Char,

		destructive:       palette.Coral,
		error:             palette.Sriracha,
		warningSubtle:     palette.Zest,
		warning:           palette.Mustard,
		denied:            palette.Tang,
		busy:              palette.Citron,
		info:              palette.Malibu,
		infoMoreSubtle:    palette.Sardine,
		infoMostSubtle:    palette.Damson,
		success:           palette.Julep,
		successMoreSubtle: palette.Bok,
		successMostSubtle: palette.Guac,
	})
}

// HyperSpectreObsidiana returns the HyperSpectre dark theme.
func HyperSpectreObsidiana() Styles {
	return quickStyle(quickStyleOpts{
		primary:   color.RGBA{0x8b, 0x5c, 0xf6, 0xff}, // purple (dashboard accent)
		secondary: color.RGBA{0x0e, 0xa5, 0x6e, 0xff}, // green (terminal green)
		accent:    palette.Bok,

		fgBase:       palette.Sash,
		fgMoreSubtle: palette.Squid,
		fgSubtle:     palette.Smoke,
		fgMostSubtle: palette.Oyster,

		onPrimary: palette.Butter,

		bgBase:         palette.Pepper,
		bgLeastVisible: palette.BBQ,
		bgLessVisible:  palette.Char,
		bgMostVisible:  palette.Iron,

		separator: palette.Char,

		destructive:       palette.Coral,
		error:             palette.Sriracha,
		warningSubtle:     palette.Zest,
		warning:           palette.Mustard,
		denied:            palette.Tang,
		busy:              palette.Citron,
		info:              palette.Malibu,
		infoMoreSubtle:    palette.Sardine,
		infoMostSubtle:    palette.Damson,
		success:           palette.Julep,
		successMoreSubtle: palette.Bok,
		successMostSubtle: palette.Guac,
	})
}
