//go:build !darwin

package notification

import (
	_ "embed"
)

//go:embed spectre-icon-solo.png
var Icon []byte
