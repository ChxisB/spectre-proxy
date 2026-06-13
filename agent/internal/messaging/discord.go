package messaging

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

// DiscordAdapter connects to Discord via the REST API (webhook polling).
type DiscordAdapter struct {
	token     string
	client    *http.Client
	handler   *Handler
	apiBase   string
	pollInterval time.Duration
	lastID    string
}

// NewDiscordAdapter creates a new Discord adapter.
func NewDiscordAdapter(token string, handler *Handler) *DiscordAdapter {
	return &DiscordAdapter{
		token:        token,
		client:       &http.Client{Timeout: 30 * time.Second},
		handler:      handler,
		apiBase:      "https://discord.com/api/v10",
		pollInterval: 2 * time.Second,
	}
}

func (d *DiscordAdapter) Name() string { return "discord" }

func (d *DiscordAdapter) Start(ctx context.Context) error {
	if d.token == "" {
		log.Println("Discord: no token configured, skipping")
		return nil
	}

	log.Println("Discord: starting poll-based listener")

	// Get bot info to verify the token
	info, err := d.getBotInfo()
	if err != nil {
		return fmt.Errorf("discord: token validation: %w", err)
	}
	log.Printf("Discord: connected as %s", info["username"])

	// Poll for messages from DM channels
	ticker := time.NewTicker(d.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			d.pollMessages(ctx)
		}
	}
}

func (d *DiscordAdapter) Send(conversationID string, text string) error {
	// conversationID is the channel ID for Discord
	url := fmt.Sprintf("%s/channels/%s/messages", d.apiBase, conversationID)

	body := map[string]any{
		"content": truncateString(text, 2000),
	}

	data, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(data))
	req.Header.Set("Authorization", "Bot "+d.token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := d.client.Do(req)
	if err != nil {
		return fmt.Errorf("discord send: %w", err)
	}
	resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("discord send: status %d", resp.StatusCode)
	}
	return nil
}

func (d *DiscordAdapter) getBotInfo() (map[string]any, error) {
	req, _ := http.NewRequest("GET", d.apiBase+"/users/@me", nil)
	req.Header.Set("Authorization", "Bot "+d.token)

	resp, err := d.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var info map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, err
	}
	return info, nil
}

func (d *DiscordAdapter) pollMessages(ctx context.Context) {
	url := d.apiBase + "/users/@me/channels"
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	req.Header.Set("Authorization", "Bot "+d.token)

	resp, err := d.client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	var channels []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&channels); err != nil {
		return
	}

	for _, ch := range channels {
		channelID, _ := ch["id"].(string)
		if channelID == "" {
			continue
		}
		d.checkChannel(ctx, channelID)
	}
}

func (d *DiscordAdapter) checkChannel(ctx context.Context, channelID string) {
	url := fmt.Sprintf("%s/channels/%s/messages?limit=1", d.apiBase, channelID)
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	req.Header.Set("Authorization", "Bot "+d.token)

	resp, err := d.client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	var messages []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&messages); err != nil {
		return
	}

	if len(messages) == 0 {
		return
	}

	msg := messages[0]
	msgID, _ := msg["id"].(string)
	if msgID == d.lastID {
		return
	}

	// Check if this message is from a user (not the bot itself)
	author, _ := msg["author"].(map[string]any)
	bot, _ := author["bot"].(bool)
	if bot {
		d.lastID = msgID
		return
	}

	content, _ := msg["content"].(string)
	if content == "" {
		return
	}

	d.lastID = msgID

	// Route to handler
	d.handler.HandleMessage(ctx, Message{
		Platform:       "discord",
		ConversationID: channelID,
		UserID:         fmt.Sprintf("%v", author["id"]),
		Text:           content,
	})
}

func truncateString(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max])
}
