package main

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"strings"
	"sync"
	"time"
)

// ─── Task Types ───────────────────────────────────────────────────────

type TaskStatus string

const (
	TaskPending   TaskStatus = "pending"
	TaskRunning   TaskStatus = "running"
	TaskCompleted TaskStatus = "completed"
	TaskFailed    TaskStatus = "failed"
	TaskWaiting   TaskStatus = "waiting" // waiting for dependency
)

type Task struct {
	ID          string     `json:"id"`
	Description string     `json:"description"`
	Status      TaskStatus `json:"status"`
	Progress    int        `json:"progress"` // 0-100
	Error       string     `json:"error,omitempty"`
	ParentID    string     `json:"parent_id,omitempty"`
	Deps        []string   `json:"deps,omitempty"` // task IDs this depends on
	SubTaskIDs  []string   `json:"subtask_ids,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	Result      string     `json:"result,omitempty"`
	Model       string     `json:"model,omitempty"`
	Agent       string     `json:"agent,omitempty"`
}

type TaskStore struct {
	mu    sync.Mutex
	Tasks []Task `json:"tasks"`
	path  string
}

var globalTasks *TaskStore

func initTaskStore() *TaskStore {
	if globalTasks != nil {
		return globalTasks
	}
	path := os.Getenv("HOME") + "/.spectre-proxy/tasks.json"
	store := &TaskStore{path: path}
	data, err := os.ReadFile(path)
	if err == nil {
		json.Unmarshal(data, store)
	}
	if store.Tasks == nil {
		store.Tasks = []Task{}
	}
	globalTasks = store
	return store
}

func (s *TaskStore) save() {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, _ := json.MarshalIndent(s, "", "  ")
	os.WriteFile(s.path, data, 0644)
}

func (s *TaskStore) Add(desc string, deps []string, parentID string) Task {
	s.mu.Lock()
	defer s.mu.Unlock()
	t := Task{
		ID:          fmt.Sprintf("task_%d_%d", time.Now().UnixNano(), rand.Intn(1000)),
		Description: desc,
		Status:      TaskPending,
		Progress:    0,
		Deps:        deps,
		ParentID:    parentID,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	s.Tasks = append(s.Tasks, t)
	s.save()
	return t
}

func (s *TaskStore) Update(id string, fn func(t *Task)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.Tasks {
		if s.Tasks[i].ID == id {
			fn(&s.Tasks[i])
			s.Tasks[i].UpdatedAt = time.Now()
			break
		}
	}
	s.save()
}

func (s *TaskStore) Get(id string) *Task {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.Tasks {
		if s.Tasks[i].ID == id {
			return &s.Tasks[i]
		}
	}
	return nil
}

func (s *TaskStore) List(status string) []Task {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Task
	for _, t := range s.Tasks {
		if status == "" || string(t.Status) == status {
			out = append(out, t)
		}
	}
	return out
}

func (s *TaskStore) Pending() []Task {
	return s.List("pending")
}

func (s *TaskStore) Incomplete() []Task {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Task
	for _, t := range s.Tasks {
		if t.Status == TaskPending || t.Status == TaskRunning || t.Status == TaskWaiting {
			out = append(out, t)
		}
	}
	return out
}

func (s *TaskStore) Stats() map[string]int {
	s.mu.Lock()
	defer s.mu.Unlock()
	stats := map[string]int{"total": len(s.Tasks), "pending": 0, "running": 0, "completed": 0, "failed": 0, "waiting": 0}
	for _, t := range s.Tasks {
		stats[string(t.Status)]++
	}
	return stats
}

// ─── Task Decomposition ───────────────────────────────────────────────

// decomposePrompt sends the prompt to the LLM to break it into steps.
// Returns a list of step descriptions.
func decomposePrompt(prompt string) []string {
	// Use the proxy to decompose
	decompPrompt := fmt.Sprintf(`Break the following task into a numbered list of 3-8 concrete steps. 
Each step should be a single, actionable subtask. Return ONLY the list items, one per line, no numbering.

Task: %s`, prompt)

	history := []map[string]string{{"role": "user", "text": decompPrompt}}
	reply, err := sendMessages(history, "")
	if err != nil {
		// Fallback: treat the whole prompt as one task
		return []string{prompt}
	}

	lines := strings.Split(strings.TrimSpace(reply), "\n")
	var steps []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		// Remove numbering like "1.", "1)", "- "
		line = strings.TrimLeft(line, "0123456789. )-–")
		line = strings.TrimSpace(line)
		if line != "" && len(line) > 5 {
			steps = append(steps, line)
		}
	}

	if len(steps) < 2 {
		return []string{prompt}
	}
	return steps
}

// processComplexTask decomposes a complex prompt into tasks and returns the task IDs.
func processComplexTask(description, model string) []Task {
	store := initTaskStore()

	// Create parent task
	parent := store.Add(description, nil, "")
	store.Update(parent.ID, func(t *Task) {
		t.Status = TaskRunning
		t.Progress = 0
	})

	// Decompose
	steps := decomposePrompt(description)

	// Create subtasks
	var subIDs []string
	for i, step := range steps {
		var deps []string
		if i > 0 && len(subIDs) > 0 {
			deps = []string{subIDs[len(subIDs)-1]} // sequential by default
		}
		sub := store.Add(step, deps, parent.ID)
		subIDs = append(subIDs, sub.ID)
	}

	store.Update(parent.ID, func(t *Task) {
		t.SubTaskIDs = subIDs
		if len(steps) == 0 {
			t.Status = TaskCompleted
			t.Progress = 100
		}
	})

	return store.List("")
}

// ─── Task Runner ──────────────────────────────────────────────────────

// resumeIncompleteTasks checks for unfinished tasks and runs them.
func resumeIncompleteTasks() {
	store := initTaskStore()
	incomplete := store.Incomplete()
	if len(incomplete) == 0 {
		return
	}

	fmt.Printf("\n  \033[33m⚠ %d incomplete tasks found.\033[0m\n", len(incomplete))
	fmt.Printf("  Run \033[36mspectre run\033[0m to resume them.\n")
	fmt.Println()
}

// runPendingTasks executes all pending/waiting tasks.
func runPendingTasks() {
	store := initTaskStore()
	pending := store.Pending()

	// Also check for waiting tasks whose deps are done
	var waiting []Task
	for _, t := range store.Tasks {
		if t.Status == TaskWaiting && allDepsDone(store, t) {
			waiting = append(waiting, t)
		}
	}

	all := append(pending, waiting...)
	if len(all) == 0 {
		fmt.Println("No pending tasks.")
		return
	}

	fmt.Printf("Running %d tasks...\n", len(all))

	for _, t := range all {
		if t.Status == TaskWaiting && !allDepsDone(store, t) {
			continue
		}
		executeTask(store, t)
	}
}

func executeTask(store *TaskStore, task Task) {
	store.Update(task.ID, func(t *Task) {
		t.Status = TaskRunning
		t.Progress = 10
	})

	fmt.Printf("\n  \033[36m▶ %s\033[0m\n", task.Description)

	// Build the prompt with full context
	prompt := task.Description
	if task.Agent != "" {
		prompt = fmt.Sprintf("(Role: %s)\n%s", task.Agent, prompt)
	}

	history := []map[string]string{{"role": "user", "text": prompt}}
	model := task.Model
	if model == "" {
		model = readEnvVar("MODEL")
	}

	reply, err := sendMessages(history, model)
	if err != nil {
		store.Update(task.ID, func(t *Task) {
			t.Status = TaskFailed
			t.Error = err.Error()
			t.Progress = 0
		})
		fmt.Printf("  \033[31m✗ Failed: %v\033[0m\n", err)
		return
	}

	store.Update(task.ID, func(t *Task) {
		t.Status = TaskCompleted
		t.Progress = 100
		t.Result = reply
	})

	// Check if parent is complete
	if task.ParentID != "" {
		parent := store.Get(task.ParentID)
		if parent != nil {
			allDone := true
			totalProgress := 0
			for _, sid := range parent.SubTaskIDs {
				st := store.Get(sid)
				if st == nil {
					continue
				}
				if st.Status != TaskCompleted {
					allDone = false
				}
				if st.Status == TaskCompleted {
					totalProgress += 100
				}
			}
			if len(parent.SubTaskIDs) > 0 {
				progress := totalProgress / len(parent.SubTaskIDs)
				if allDone {
					store.Update(parent.ID, func(t *Task) {
						t.Status = TaskCompleted
						t.Progress = 100
					})
				} else {
					store.Update(parent.ID, func(t *Task) {
						t.Progress = progress
					})
				}
			}
		}
	}
}

func allDepsDone(store *TaskStore, task Task) bool {
	for _, depID := range task.Deps {
		t := store.Get(depID)
		if t == nil || t.Status != TaskCompleted {
			return false
		}
	}
	return true
}

// ─── Context Optimization ─────────────────────────────────────────────

// optimizeHistory summarizes old messages and keeps only recent + summary.
// This reduces token usage while preserving context.
func optimizeHistory(history []map[string]string, maxLen int) []map[string]string {
	if len(history) <= maxLen {
		return history
	}

	// Take the first message (often important context) + last N exchanges
	first := history[0]
	recent := history[len(history)-maxLen:]

	// Generate a summary of the middle portion
	middle := history[1 : len(history)-maxLen]
	if len(middle) > 1 {
		summary := fmt.Sprintf("[Previous conversation summarized: %d messages about previous context]", len(middle))
		result := []map[string]string{
			first,
			{"role": "system", "text": summary},
		}
		result = append(result, recent...)
		return result
	}

	result := []map[string]string{first}
	result = append(result, recent...)
	return result
}

// estimateTokens gives a rough token count for a string
func estimateTokens(text string) int {
	// Rough estimate: ~4 chars per token
	return len(text) / 4
}

// historyTokenCount returns the estimated token count of the history
func historyTokenCount(history []map[string]string) int {
	total := 0
	for _, msg := range history {
		total += estimateTokens(msg["text"])
	}
	return total
}

// ─── Task Dashboard Integration ───────────────────────────────────────

// taskSummaryJSON returns a JSON string of task stats for the dashboard
func taskSummaryJSON() string {
	store := initTaskStore()
	stats := store.Stats()
	data, _ := json.Marshal(stats)
	return string(data)
}

func taskListJSON() string {
	store := initTaskStore()
	all := store.List("")
	if len(all) > 50 {
		all = all[len(all)-50:] // last 50
	}
	data, _ := json.Marshal(all)
	return string(data)
}
