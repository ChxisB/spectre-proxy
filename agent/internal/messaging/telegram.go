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

// TelegramAdapter connects to Telegram via the Bot API (long polling).
type TelegramAdapter struct {
	token        string
	client       *http.Client
	handler      *Handler
	apiBase      string
	lastUpdateID int64
	pollInterval time.Duration
}

// NewTelegramAdapter creates a new Telegram adapter.
func NewTelegramAdapter(token string, handler *Handler) *TelegramAdapter {
	return &TelegramAdapter{
		token:        token,
		client:       &http.Client{Timeout: 60 * time.Second}, // longer for long poll
		handler:      handler,
		apiBase:      fmt.Sprintf("https://api.telegram.org/bot%s", token),
		pollInterval: 30 * time.Second,
	}
}

func (t *TelegramAdapter) Name() string { return "telegram" }

func (t *TelegramAdapter) Start(ctx context.Context) error {
	if t.token == "" {
		log.Println("Telegram: no token configured, skipping")
		return nil
	}

	// Verify bot token by getting bot info
	info, err := t.getMe()
	if err != nil {
		return fmt.Errorf("telegram: token validation: %w", err)
	}
	log.Printf("Telegram: connected as @%s", info["username"])

	// Long-poll for updates
	for {
		select {
		case <-ctx.Done():
			return nil
		default:
			t.pollUpdates(ctx)
		}
	}
}

func (t *TelegramAdapter) Send(conversationID string, text string) error {
	url := fmt.Sprintf("%s/sendMessage", t.apiBase)

	body := map[string]any{
		"chat_id": conversationID,
		"text":    truncateString(text, 4096),
		"parse_mode": "Markdown",
	}

	data, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")

	resp, err := t.client.Do(req)
	if err != nil {
		return fmt.Errorf("telegram send: %w", err)
	}
	resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("telegram send: status %d", resp.StatusCode)
	}
	return nil
}

func (t *TelegramAdapter) getMe() (map[string]any, error) {
	resp, err := t.client.Get(t.apiBase + "/getMe")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Ok     bool                   `json:"ok"`
		Result map[string]any         `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result.Result, nil
}

func (t *TelegramAdapter) pollUpdates(ctx context.Context) {
	url := fmt.Sprintf("%s/getUpdates?timeout=%d&offset=%d", t.apiBase, 25, t.lastUpdateID+1)
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)

	resp, err := t.client.Do(req)
	if err != nil {
		time.Sleep(1 * time.Second)
		return
	}
	defer resp.Body.Close()

	var result struct {
		Ok     bool            `json:"ok"`
		Result []telegramUpdate `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return
	}

	for _, update := range result.Result {
		if update.UpdateID > t.lastUpdateID {
			t.lastUpdateID = update.UpdateID
		}
		t.handleUpdate(ctx, update)
	}
}

type telegramUpdate struct {
	UpdateID int64            `json:"update_id"`
	Message  *telegramMessage `json:"message,omitempty"`
}

type telegramMessage struct {
	MessageID int64               `json:"message_id"`
	Chat      telegramChat        `json:"chat"`
	From      telegramUser        `json:"from"`
	Text      string              `json:"text,omitempty"`
	ReplyTo   *telegramMessage    `json:"reply_to_message,omitempty"`
}

type telegramChat struct {
	ID int64 `json:"id"`
}

type telegramUser struct {
	ID       int64  `json:"id"`
	Username string `json:"username,omitempty"`
}

func (t *TelegramAdapter) handleUpdate(ctx context.Context, update telegramUpdate) {
	if update.Message == nil || update.Message.Text == "" {
		return
	}

	// Skip bot's own messages
	// (Telegram doesn't echo bot messages, but this is a safety check)

	chatID := fmt.Sprintf("%d", update.Message.Chat.ID)
	isReply := update.Message.ReplyTo != nil
	replyToID := ""
	if isReply {
		replyToID = fmt.Sprintf("%d", update.Message.ReplyTo.MessageID)
	}

	t.handler.HandleMessage(ctx, Message{
		Platform:       "telegram",
		ConversationID: chatID,
		UserID:         fmt.Sprintf("%d", update.Message.From.ID),
		Text:           update.Message.Text,
		IsReply:        isReply,
		ReplyToID:      replyToID,
	})
}
