package server

import "strings"

// stringsContains is a helper alias for strings.Contains
func stringsContains(s, substr string) bool {
	return strings.Contains(s, substr)
}

// splitLines splits a string by newlines.
func splitLines(s string) []string {
	if s == "" {
		return nil
	}
	return strings.Split(s, "\n")
}

// trimSpace removes leading and trailing whitespace.
func trimSpace(s string) string {
	return strings.TrimSpace(s)
}
