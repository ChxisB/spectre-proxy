package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// ─── MCP Server ───────────────────────────────────────────────────────
// Implements the Model Context Protocol over stdio.
// claude launches this as a subprocess and communicates via JSON-RPC.

type MCPRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type MCPResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int         `json:"id"`
	Result  interface{} `json:"result,omitempty"`
	Error   *MCPError   `json:"error,omitempty"`
}

type MCPError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type MCPTool struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
}

var mcpTools = []MCPTool{
	{
		Name:        "vault_search",
		Description: "Search the Obsidian vault for notes matching a query",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"query": map[string]any{"type": "string", "description": "Search query"},
			},
			"required": []string{"query"},
		},
	},
	{
		Name:        "vault_read",
		Description: "Read a specific note from the Obsidian vault by path",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"path": map[string]any{"type": "string", "description": "Relative note path (e.g. 'Memories/2026-06-07.md')"},
			},
			"required": []string{"path"},
		},
	},
	{
		Name:        "vault_graph",
		Description: "Get the knowledge graph of the vault (nodes = notes, links = [[wikilinks]])",
		InputSchema: map[string]any{
			"type":       "object",
			"properties": map[string]any{},
		},
	},
	{
		Name:        "task_create",
		Description: "Create a new task in the task board",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"text":   map[string]any{"type": "string", "description": "Task description"},
				"column": map[string]any{"type": "string", "description": "Column: todo, progress, or done", "default": "todo"},
			},
			"required": []string{"text"},
		},
	},
	{
		Name:        "task_list",
		Description: "List all tasks, optionally filtered by column",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"column": map[string]any{"type": "string", "description": "Filter by column: todo, progress, done, or empty for all"},
			},
		},
	},
	{
		Name:        "sub_agent_chat",
		Description: "Send a prompt to a specialized expert sub-agent (auto-detects the best agent). Agents: Flutter Developer, Frontend Developer (React/Next.js), Backend Developer (Go/Python/Rust/Zig), DevOps (GCP/AWS/Azure/Docker), Data Engineer (PostgreSQL/analytics)",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"prompt": map[string]any{"type": "string", "description": "The task or question for the expert"},
				"agent":  map[string]any{"type": "string", "description": "Optional: force a specific agent name. Leave empty for auto-detect"},
			},
			"required": []string{"prompt"},
		},
	},
	{
		Name:        "task_decompose",
		Description: "Break a complex prompt into individual subtasks with dependencies",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"prompt": map[string]any{"type": "string", "description": "The complex task or goal to decompose"},
			},
			"required": []string{"prompt"},
		},
	},
	{
		Name:        "task_progress",
		Description: "Get current task progress and stats for all tasks",
		InputSchema: map[string]any{
			"type":       "object",
			"properties": map[string]any{},
		},
	},
	{
		Name:        "code_review",
		Description: "Review code for issues, security, and best practices",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"code":     map[string]any{"type": "string", "description": "The code to review"},
				"language": map[string]any{"type": "string", "description": "Programming language"},
			},
			"required": []string{"code"},
		},
	},
}

func runMCPServer() {
	scanner := bufio.NewScanner(os.Stdin)
	// Send initialize response immediately
	initResp := MCPResponse{
		JSONRPC: "2.0",
		ID:      1,
		Result: map[string]any{
			"protocolVersion": "2024-11-05",
			"capabilities":    map[string]any{"tools": map[string]any{}},
			"serverInfo":      map[string]any{"name": "spectre", "version": Version},
		},
	}
	writeJSON(initResp)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var req MCPRequest
		if err := json.Unmarshal([]byte(line), &req); err != nil {
			continue
		}

		switch req.Method {
		case "tools/list":
			writeJSON(MCPResponse{
				JSONRPC: "2.0", ID: req.ID,
				Result: map[string]any{"tools": mcpTools},
			})

		case "tools/call":
			var params struct {
				Name      string          `json:"name"`
				Arguments json.RawMessage `json:"arguments"`
			}
			json.Unmarshal(req.Params, &params)
			result := handleToolCall(params.Name, params.Arguments)
			writeJSON(MCPResponse{JSONRPC: "2.0", ID: req.ID, Result: result})

		case "notifications/initialized":
			// No response needed

		default:
			writeJSON(MCPResponse{
				JSONRPC: "2.0", ID: req.ID,
				Error: &MCPError{Code: -32601, Message: fmt.Sprintf("Method not found: %s", req.Method)},
			})
		}
	}
}

func writeJSON(v any) {
	data, _ := json.Marshal(v)
	fmt.Println(string(data))
}

// ─── Tool Handlers ────────────────────────────────────────────────────

func handleToolCall(name string, rawArgs json.RawMessage) map[string]any {
	content := func(text string) map[string]any {
		return map[string]any{
			"content": []map[string]any{{"type": "text", "text": text}},
		}
	}

	switch name {
	case "vault_search":
		var args struct {
			Query string `json:"query"`
		}
		json.Unmarshal(rawArgs, &args)
		return content(toolVaultSearch(args.Query))

	case "vault_read":
		var args struct {
			Path string `json:"path"`
		}
		json.Unmarshal(rawArgs, &args)
		return content(toolVaultRead(args.Path))

	case "vault_graph":
		return content(toolVaultGraph())

	case "task_create":
		var args struct {
			Text   string `json:"text"`
			Column string `json:"column"`
		}
		json.Unmarshal(rawArgs, &args)
		if args.Column == "" {
			args.Column = "todo"
		}
		return content(toolTaskCreate(args.Text, args.Column))

	case "task_list":
		var args struct {
			Column string `json:"column"`
		}
		json.Unmarshal(rawArgs, &args)
		return content(toolTaskList(args.Column))

	case "sub_agent_chat":
		var args struct {
			Prompt string `json:"prompt"`
			Agent  string `json:"agent"`
		}
		json.Unmarshal(rawArgs, &args)
		return content(toolSubAgentChat(args.Prompt, args.Agent))

	case "task_decompose":
		var args struct {
			Prompt string `json:"prompt"`
		}
		json.Unmarshal(rawArgs, &args)
		return content(toolTaskDecompose(args.Prompt))

	case "task_progress":
		return content(taskSummaryJSON())

	case "code_review":
		var args struct {
			Code     string `json:"code"`
			Language string `json:"language"`
		}
		json.Unmarshal(rawArgs, &args)
		return content(toolCodeReview(args.Code, args.Language))

	default:
		return map[string]any{
			"content": []map[string]any{{"type": "text", "text": fmt.Sprintf("Unknown tool: %s", name)}},
			"isError": true,
		}
	}
}

// ─── MCP Config File ─────────────────────────────────────────────────
// Manages ~/.spectre-proxy/mcp.json — user-editable MCP server definitions.

func mcpConfigPath() string {
	return os.Getenv("HOME") + "/.spectre-proxy/mcp.json"
}

func claudeSettingsPath() string {
	return os.Getenv("HOME") + "/.claude/settings.json"
}

// readMCPConfig reads ~/.spectre-proxy/mcp.json, creating defaults if missing.
func readMCPConfig() map[string]any {
	path := mcpConfigPath()
	os.MkdirAll(os.Getenv("HOME")+"/.spectre-proxy", 0755)

	defaultConfig := map[string]any{
		"mcpServers": map[string]any{
			"spectre": map[string]any{
				"command": os.Args[0],
				"args":    []string{"mcp-server"},
			},
		},
	}

	data, err := os.ReadFile(path)
	if err != nil {
		// Create default file
		defaultData, _ := json.MarshalIndent(defaultConfig, "", "  ")
		os.WriteFile(path, defaultData, 0644)
		return defaultConfig
	}

	var cfg map[string]any
	if err := json.Unmarshal(data, &cfg); err != nil {
		return defaultConfig
	}
	return cfg
}

// syncMCPToClaude reads ~/.spectre-proxy/mcp.json and writes the MCP servers
// into ~/.claude/settings.json so claude discovers them.
func syncMCPToClaude() {
	mcpCfg := readMCPConfig()

	claudeDir := os.Getenv("HOME") + "/.claude"
	os.MkdirAll(claudeDir, 0755)
	settingsPath := claudeSettingsPath()

	existing := map[string]any{}
	if data, err := os.ReadFile(settingsPath); err == nil {
		json.Unmarshal(data, &existing)
	}

	// Merge MCP servers from our config
	if servers, ok := mcpCfg["mcpServers"]; ok {
		existing["mcpServers"] = servers
	}

	merged, _ := json.MarshalIndent(existing, "", "  ")
	os.WriteFile(settingsPath, merged, 0644)
}

// ─── Tool Implementations ─────────────────────────────────────────────

func toolVaultSearch(query string) string {
	vaultRoot := os.Getenv("VAULT_PATH")
	if vaultRoot == "" {
		home, _ := os.UserHomeDir()
		vaultRoot = home + "/Spectre Proxy/agent-vault"
	}

	if _, err := os.Stat(vaultRoot); os.IsNotExist(err) {
		return fmt.Sprintf("Vault not found at %s", vaultRoot)
	}

	var results []string
	var walkDir func(dir string, depth int)
	walkDir = func(dir string, depth int) {
		if depth > 5 {
			return
		}
		entries, err := os.ReadDir(dir)
		if err != nil {
			return
		}
		for _, e := range entries {
			path := dir + "/" + e.Name()
			if e.IsDir() {
				if e.Name()[0] != '.' {
					walkDir(path, depth+1)
				}
			} else if strings.HasSuffix(e.Name(), ".md") {
				data, err := os.ReadFile(path)
				if err != nil {
					continue
				}
				if query == "" || strings.Contains(strings.ToLower(string(data)), strings.ToLower(query)) {
					rel := strings.TrimPrefix(path, vaultRoot)
					results = append(results, rel)
				}
			}
		}
	}
	walkDir(vaultRoot, 0)

	if len(results) == 0 {
		return "No matching notes found."
	}
	limit := 20
	if len(results) < limit {
		limit = len(results)
	}
	return fmt.Sprintf("Found %d matching notes:\n%s", len(results), strings.Join(results[:limit], "\n"))
}

func toolVaultRead(path string) string {
	vaultRoot := os.Getenv("VAULT_PATH")
	if vaultRoot == "" {
		home, _ := os.UserHomeDir()
		vaultRoot = home + "/Spectre Proxy/agent-vault"
	}
	fullPath := vaultRoot + "/" + strings.TrimPrefix(path, "/")
	data, err := os.ReadFile(fullPath)
	if err != nil {
		return fmt.Sprintf("Error reading note: %v", err)
	}
	return string(data)
}

func toolVaultGraph() string {
	vaultRoot := os.Getenv("VAULT_PATH")
	if vaultRoot == "" {
		home, _ := os.UserHomeDir()
		vaultRoot = home + "/Spectre Proxy/agent-vault"
	}

	if _, err := os.Stat(vaultRoot); os.IsNotExist(err) {
		return fmt.Sprintf("Vault not found at %s", vaultRoot)
	}
	count := 0
	var walkDir func(dir string, depth int)
	walkDir = func(dir string, depth int) {
		if depth > 5 {
			return
		}
		entries, err := os.ReadDir(dir)
		if err != nil {
			return
		}
		for _, e := range entries {
			if e.IsDir() {
				if e.Name()[0] != '.' {
					walkDir(dir+"/"+e.Name(), depth+1)
				}
			} else if strings.HasSuffix(e.Name(), ".md") {
				count++
			}
		}
	}
	walkDir(vaultRoot, 0)
	return fmt.Sprintf("Vault has %d notes in %s", count, vaultRoot)
}

func toolTaskCreate(text, column string) string {
	store := initTaskStore()
	t := store.Add(text, nil, "")
	col := column
	if col == "" {
		col = "todo"
	}
	status := TaskPending
	if col == "done" {
		status = TaskCompleted
	}
	store.Update(t.ID, func(task *Task) {
		task.Status = status
	})
	return fmt.Sprintf("Task created: %s (id: %s)", text, t.ID)
}

func toolTaskList(column string) string {
	store := initTaskStore()
	all := store.List("")
	if column != "" {
		var status TaskStatus
		switch column {
		case "todo":
			status = TaskPending
		case "progress":
			status = TaskRunning
		case "done":
			status = TaskCompleted
		default:
			status = TaskPending
		}
		var filtered []Task
		for _, t := range all {
			if t.Status == status {
				filtered = append(filtered, t)
			}
		}
		all = filtered
	}
	if len(all) == 0 {
		return "No tasks found."
	}
	var b strings.Builder
	for _, t := range all {
		progress := ""
		if t.Progress > 0 && t.Progress < 100 {
			progress = fmt.Sprintf(" [%d%%]", t.Progress)
		}
		b.WriteString(fmt.Sprintf("[%s%s] %s\n", t.Status, progress, t.Description))
		if len(t.SubTaskIDs) > 0 {
			for _, sid := range t.SubTaskIDs {
				st := store.Get(sid)
				if st != nil {
					b.WriteString(fmt.Sprintf("  └ [%s] %s\n", st.Status, st.Description))
				}
			}
		}
	}
	return b.String()
}

func toolTaskDecompose(prompt string) string {
	tasks := processComplexTask(prompt, "")
	return fmt.Sprintf("Decomposed into %d tasks:\n", len(tasks)) + toolTaskList("")
}

func toolSubAgentChat(prompt, forcedAgent string) string {
	agent := detectAgent(prompt, forcedAgent)
	instructions := agentInstructions(agent)

	fullPrompt := instructions + "\n\nUser request: " + prompt
	model := ""

	// Get model from env or use default
	if m := readEnvVar("MODEL"); m != "" {
		model = m
	}
	if agentModel := readEnvVar("SUB_AGENT_MODEL"); agentModel != "" {
		model = agentModel
	}

	// If the proxy isn't running, try to start it
	ensureProxy()

	// Send through proxy
	history := []map[string]string{{"role": "user", "text": fullPrompt}}
	reply, err := sendMessages(history, model)
	if err != nil {
		return fmt.Sprintf("Error from %s agent: %v", agent, err)
	}
	return fmt.Sprintf("**%s Expert Response:**\n\n%s", agent, reply)
}

func toolCodeReview(code, language string) string {
	if language == "" {
		language = "code"
	}
	prompt := fmt.Sprintf("Review this %s code for bugs, security issues, performance problems, and best practices. Provide specific suggestions:\n\n```%s\n%s\n```", language, language, code)
	return toolSubAgentChat(prompt, "Backend Developer")
}

// Task types are defined in tasks.go
