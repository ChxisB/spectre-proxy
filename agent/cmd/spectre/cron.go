package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
)

// ─── Cron Jobs ────────────────────────────────────────────────────────

type CronJob struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Prompt    string `json:"prompt"`
	Interval  string `json:"interval"` // "15m", "1h", "1d", etc.
	Agent     string `json:"agent,omitempty"`
	Enabled   bool   `json:"enabled"`
	LastRun   string `json:"last_run,omitempty"`
	CreatedAt string `json:"created_at"`
}

func cronFilePath() string {
	return os.Getenv("HOME") + "/.spectre-proxy/cron.json"
}

func loadCron() []CronJob {
	data, err := os.ReadFile(cronFilePath())
	if err != nil {
		return nil
	}
	var jobs []CronJob
	json.Unmarshal(data, &jobs)
	return jobs
}

func saveCron(jobs []CronJob) {
	data, _ := json.MarshalIndent(jobs, "", "  ")
	os.WriteFile(cronFilePath(), data, 0644)
}

// cronList prints all scheduled cron jobs
func cronList() {
	jobs := loadCron()
	if len(jobs) == 0 {
		fmt.Println("No cron jobs scheduled.")
		return
	}
	fmt.Printf("Scheduled jobs (%d):\n", len(jobs))
	for _, j := range jobs {
		status := "✓"
		if !j.Enabled {
			status = "✗"
		}
		fmt.Printf("  %s [%s] %s (every %s)\n", status, j.ID[:8], j.Name, j.Interval)
		if j.LastRun != "" {
			fmt.Printf("       Last run: %s\n", j.LastRun)
		}
	}
}

// cronRun executes all due cron jobs
func cronRun() {
	jobs := loadCron()
	now := time.Now()
	ran := 0

	for _, j := range jobs {
		if !j.Enabled {
			continue
		}
		if j.LastRun != "" {
			last, err := time.Parse(time.RFC3339, j.LastRun)
			if err != nil {
				continue
			}
			dur, err := time.ParseDuration(j.Interval)
			if err != nil {
				continue
			}
			if now.Before(last.Add(dur)) {
				continue
			} // not due yet
		}

		fmt.Printf("Running cron: %s\n", j.Name)

		var result string
		if j.Prompt == "__dream__" {
			// Special: run the dream cycle
			dreamCycle()
			result = "Dream cycle completed."
		} else {
			agent := j.Agent
			if agent == "" {
				agent = detectAgent(j.Prompt, "")
			}
			result = toolSubAgentChat(j.Prompt, agent)
		}

		// Save result as a task
		store := initTaskStore()
		t := store.Add(fmt.Sprintf("[Cron] %s", j.Name), nil, "")
		store.Update(t.ID, func(task *Task) {
			task.Status = TaskCompleted
			task.Progress = 100
			task.Result = result
		})

		// Update last run time
		for i := range jobs {
			if jobs[i].ID == j.ID {
				jobs[i].LastRun = now.Format(time.RFC3339)
				break
			}
		}
		ran++
	}

	saveCron(jobs)
	fmt.Printf("Ran %d cron jobs.\n", ran)
}

// cronAdd adds a new cron job
func cronAdd(name, prompt, interval, agent string) {
	jobs := loadCron()
	job := CronJob{
		ID:        fmt.Sprintf("cron_%d", time.Now().UnixNano()),
		Name:      name,
		Prompt:    prompt,
		Interval:  interval,
		Agent:     agent,
		Enabled:   true,
		CreatedAt: time.Now().Format(time.RFC3339),
	}
	jobs = append(jobs, job)
	saveCron(jobs)
	fmt.Printf("Cron job created: %s (every %s)\n", name, interval)
}

// ─── Dreaming ─────────────────────────────────────────────────────────
// Dreaming processes vault information in the background,
// finding connections, generating insights, and creating tasks.

func dreamCycle() {
	vaultRoot := os.Getenv("VAULT_PATH")
	if vaultRoot == "" {
		home, _ := os.UserHomeDir()
		vaultRoot = home + "/Spectre Proxy/agent-vault"
	}

	if _, err := os.Stat(vaultRoot); os.IsNotExist(err) {
		fmt.Println("Vault not found. Set VAULT_PATH or create ~/Spectre Proxy/agent-vault")
		return
	}

	fmt.Println("Starting dream cycle...")
	fmt.Printf("Reading vault: %s\n", vaultRoot)

	// Count and list recent notes
	var allNotes []string
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
				allNotes = append(allNotes, strings.TrimPrefix(path, vaultRoot+"/"))
			}
		}
	}
	walkDir(vaultRoot, 0)

	if len(allNotes) == 0 {
		fmt.Println("No notes found in vault.")
		return
	}

	fmt.Printf("Found %d notes in vault.\n", len(allNotes))

	// Pick a random recent note to "dream" about
	// Generate insight about connections between notes
	prompt := fmt.Sprintf(`I have an Obsidian vault with %d notes. Here are the notes:
%s

Review these notes and suggest:
1. Connections between notes I may have missed ([[wikilinks]] to add)
2. A new insight or summary based on the content
3. A task to improve the vault organization

Focus on finding non-obvious connections.`,
		len(allNotes),
		strings.Join(allNotes[:min(20, len(allNotes))], "\n"))

	history := []map[string]string{{"role": "user", "text": prompt}}
	reply, err := sendMessages(history, "")
	if err != nil {
		fmt.Printf("Dream cycle error: %v\n", err)
		return
	}

	// Save the insight as a task
	store := initTaskStore()
	t := store.Add("[Dream] Vault insight generation", nil, "")
	store.Update(t.ID, func(task *Task) {
		task.Status = TaskCompleted
		task.Progress = 100
		task.Result = reply
	})

	fmt.Println("Dream cycle complete. Insight saved to tasks.")
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
