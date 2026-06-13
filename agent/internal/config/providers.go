package config

// ProviderDescriptor describes a single provider for the admin UI and registry.
type ProviderDescriptor struct {
	ID           string
	Label        string
	APIType      string // "openai" or "anthropic"
	DocsURL      string
	RequiresKey  bool
	SupportsThinking bool
}

// ProviderCatalog returns the full list of supported providers.
func ProviderCatalog() []ProviderDescriptor {
	return []ProviderDescriptor{
		{ID: "open_router",     Label: "OpenRouter",        APIType: "anthropic", DocsURL: "https://openrouter.ai",        RequiresKey: true,  SupportsThinking: true},
		{ID: "nvidia_nim",      Label: "NVIDIA NIM",        APIType: "openai",    DocsURL: "https://build.nvidia.com",        RequiresKey: true,  SupportsThinking: true},
		{ID: "gemini",          Label: "Gemini",             APIType: "openai",    DocsURL: "https://aistudio.google.com",     RequiresKey: true,  SupportsThinking: true},
		{ID: "deepseek",        Label: "DeepSeek",           APIType: "anthropic", DocsURL: "https://platform.deepseek.com",    RequiresKey: true,  SupportsThinking: true},
		{ID: "mistral",         Label: "Mistral",            APIType: "openai",    DocsURL: "https://console.mistral.ai",      RequiresKey: true,  SupportsThinking: true},
		{ID: "codestral",       Label: "Codestral",          APIType: "openai",    DocsURL: "https://console.mistral.ai",      RequiresKey: true,  SupportsThinking: true},
		{ID: "opencode",        Label: "OpenCode Zen",       APIType: "openai",    DocsURL: "https://opencode.ai",             RequiresKey: true,  SupportsThinking: true},
		{ID: "opencode_go",     Label: "OpenCode Go",        APIType: "openai",    DocsURL: "https://opencode.ai",             RequiresKey: true,  SupportsThinking: true},
		{ID: "wafer",           Label: "Wafer",              APIType: "anthropic", DocsURL: "https://wafer.ai",                RequiresKey: true,  SupportsThinking: true},
		{ID: "kimi",            Label: "Kimi",               APIType: "anthropic", DocsURL: "https://platform.moonshot.ai",    RequiresKey: true,  SupportsThinking: true},
		{ID: "cerebras",        Label: "Cerebras",           APIType: "openai",    DocsURL: "https://cloud.cerebras.ai",       RequiresKey: true,  SupportsThinking: true},
		{ID: "groq",            Label: "Groq",               APIType: "openai",    DocsURL: "https://console.groq.com",        RequiresKey: true,  SupportsThinking: true},
		{ID: "fireworks",       Label: "Fireworks",          APIType: "anthropic", DocsURL: "https://fireworks.ai",            RequiresKey: true,  SupportsThinking: true},
		{ID: "zai",             Label: "Z.ai",               APIType: "anthropic", DocsURL: "https://z.ai",                    RequiresKey: true,  SupportsThinking: true},
		{ID: "lmstudio",        Label: "LM Studio",          APIType: "anthropic", DocsURL: "http://localhost:1234",            RequiresKey: false, SupportsThinking: true},
		{ID: "llamacpp",        Label: "llama.cpp",          APIType: "anthropic", DocsURL: "http://localhost:8080",            RequiresKey: false, SupportsThinking: true},
		{ID: "ollama",          Label: "Ollama",             APIType: "anthropic", DocsURL: "http://localhost:11434",           RequiresKey: false, SupportsThinking: true},
	}
}

// SupportedProviderIDs returns the set of all supported provider IDs.
func SupportedProviderIDs() map[string]bool {
	ids := make(map[string]bool)
	for _, p := range ProviderCatalog() {
		ids[p.ID] = true
	}
	return ids
}

// ProviderByID returns the descriptor for the given provider ID.
func ProviderByID(id string) *ProviderDescriptor {
	for _, p := range ProviderCatalog() {
		if p.ID == id {
			return &p
		}
	}
	return nil
}
