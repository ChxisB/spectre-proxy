package protocol

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

// SSEHeaders returns the standard Anthropic SSE response headers.
func SSEHeaders() map[string]string {
	return map[string]string{
		"Content-Type":           "text/event-stream",
		"Cache-Control":          "no-cache",
		"Connection":             "keep-alive",
		"X-Accel-Buffering":      "no",
	}
}

// WriteSSEEvent writes a single SSE event to the writer.
func WriteSSEEvent(w io.Writer, eventType string, data any) error {
	var buf bytes.Buffer
	buf.WriteString(fmt.Sprintf("event: %s\n", eventType))
	
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal sse data: %w", err)
	}
	
	// Split data into multiple lines if needed (Anthropic style: single data line)
	buf.WriteString(fmt.Sprintf("data: %s\n\n", string(jsonData)))
	
	_, err = w.Write(buf.Bytes())
	return err
}

// ReadSSEEvent reads a single SSE event from the scanner.
// Returns the event type and raw data bytes.
func ReadSSEEvent(scanner *bufio.Scanner) (*SSEEvent, error) {
	var eventType string
	var dataBuf bytes.Buffer

	for scanner.Scan() {
		line := scanner.Text()
		
		if strings.HasPrefix(line, "event: ") {
			eventType = strings.TrimPrefix(line, "event: ")
		} else if strings.HasPrefix(line, "data: ") {
			dataBuf.WriteString(strings.TrimPrefix(line, "data: "))
		} else if line == "" {
			// Empty line = end of event
			if eventType == "" || dataBuf.Len() == 0 {
				eventType = ""
				dataBuf.Reset()
				continue
			}
			return &SSEEvent{
				Type: eventType,
				Data: dataBuf.Bytes(),
			}, nil
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return nil, io.EOF
}
