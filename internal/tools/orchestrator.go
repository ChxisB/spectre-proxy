package tools

import (
	"fmt"
	"strings"

	"github.com/ChxisB/spectre-proxy/deps/compress"
	"github.com/ChxisB/spectre-proxy/deps/filter"
	"github.com/ChxisB/spectre-proxy/deps/graph"
	"github.com/ChxisB/spectre-proxy/deps/synth"
	"github.com/ChxisB/spectre-proxy/deps/usage"
	"github.com/ChxisB/spectre-proxy/deps/viz"
)

// Orchestrator coordinates tool execution based on config.
type Orchestrator struct {
	config *Config
}

// NewOrchestrator creates an orchestrator with the given config.
func NewOrchestrator(config *Config) *Orchestrator {
	return &Orchestrator{config: config}
}

// DefaultOrchestrator creates an orchestrator with default config.
func DefaultOrchestrator() *Orchestrator {
	return NewOrchestrator(DefaultConfig())
}

// ProcessPrompt applies enabled tools to an outgoing prompt.
// This is called before sending a prompt to the LLM.
func (o *Orchestrator) ProcessPrompt(prompt string) string {
	result := prompt

	// Apply synth (Karpathy principles) if enabled
	if o.config.IsEnabled(ToolSynth) {
		if synth.ShouldActivate(prompt) || !strings.Contains(prompt, "## Karpathy") {
			result = synth.Inject(result)
		}
	}

	return result
}

// ProcessResponse applies enabled tools to an LLM response.
// This is called after receiving a response from the LLM.
func (o *Orchestrator) ProcessResponse(response string) string {
	result := response

	// Apply compression if enabled
	if o.config.IsEnabled(ToolCompress) {
		level := compress.LevelFull
		if l := o.config.GetLevel(ToolCompress); l != "" {
			level = compress.ParseLevel(l)
		}
		stats := compress.EstimateStats(result, compress.Compress(result, level))
		if stats.SavingsPercent > 10 {
			result = compress.Compress(result, level)
		}
	}

	return result
}

// FilterCommand runs a command and filters its output.
func (o *Orchestrator) FilterCommand(args []string) (*filter.Result, error) {
	if !o.config.IsEnabled(ToolFilter) {
		return nil, fmt.Errorf("filter tool is disabled")
	}
	return filter.Filter(args, filter.LevelMinimal)
}

// GenerateDiagram creates a diagram from JSON IR.
func (o *Orchestrator) GenerateDiagram(diagramJSON []byte) ([]byte, error) {
	if !o.config.IsEnabled(ToolViz) {
		return nil, fmt.Errorf("viz tool is disabled")
	}
	diagram, err := viz.Parse(diagramJSON)
	if err != nil {
		return nil, err
	}
	return viz.Generate(diagram)
}

// AnalyzeCode runs code analysis and builds a knowledge graph.
func (o *Orchestrator) AnalyzeCode(rootDir string) (*graph.Result, error) {
	if !o.config.IsEnabled(ToolGraph) {
		return nil, fmt.Errorf("graph tool is disabled")
	}
	analyzer := graph.NewAnalyzer(rootDir)
	return analyzer.Analyze()
}

// LoadUsageReport loads and summarizes token usage data.
func (o *Orchestrator) LoadUsageReport(logDir, period string) (*usage.Summary, error) {
	if !o.config.IsEnabled(ToolUsage) {
		return nil, fmt.Errorf("usage tool is disabled")
	}
	entries, err := usage.LoadDirectory(logDir)
	if err != nil {
		return nil, err
	}
	summary := usage.Summarize(entries, period)
	return &summary, nil
}

// GetStatus returns the status of all tools.
func (o *Orchestrator) GetStatus() map[ToolID]ToolStatus {
	return o.config.Status()
}

// SetToolEnabled enables or disables a tool.
func (o *Orchestrator) SetToolEnabled(id ToolID, enabled bool) {
	o.config.SetEnabled(id, enabled)
}

// SaveConfig saves the current configuration.
func (o *Orchestrator) SaveConfig() error {
	return o.config.Save()
}
