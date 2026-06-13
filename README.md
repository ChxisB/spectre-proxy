<div align="center">

# 👻 Spectre Proxy

**Multi-provider AI proxy with dashboard — for Claude Code, Cursor, opencode, VS Code, Zed, and any Anthropic-compatible client.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Go](https://img.shields.io/badge/Go-1.26-00ADD8?style=for-the-badge&logo=go)](https://go.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

A high-performance, Go-powered AI proxy that sits between your AI coding agent (or any Anthropic-compatible client) and **17+ AI providers**. Route model traffic freely, manage tasks, schedule prompts, and control everything from a beautiful Next.js dashboard.

[Quick Start](#quick-start) · [Prerequisites](#prerequisites--dependencies) · [Features](#features) · [Providers](#supported-providers) · [Architecture](#provider-architecture) · [Dashboard](#dashboard) · [IDEs](#ide-integrations) · [Aim & Scope](#aim--scope) · [Contributing](#contributing)

</div>

<div align="center">
  <img src="public/assets/screenshots/dashboard.png" alt="Spectre Proxy Dashboard" width="800">
</div>

> ⚠️ **Experimental** — Spectre Proxy is in active development. Currently only **standard Claude models and OpenRouter** have been verified working. **OpenCode Go has known issues** with certain models (e.g. DeepSeek V4 Flash). All other provider backends are implemented but **untested**. We need **your help** testing providers, reporting issues, and contributing fixes. Jump in!

---

## Features

| Feature | Status | Description |
|---------|--------|-------------|
| **Multi-provider AI gateway** | ✅ | 17 provider backends — see [test status](#currently-implemented-providers) for which are verified working |
| **Anthropic-compatible API** | ✅ | Drop-in `/v1/messages`, `/v1/messages/count_tokens`, `/v1/models` endpoints |
| **Per-model routing** | ✅ | Route Opus / Sonnet / Haiku tiers to different providers |
| **Streaming responses** | ✅ | Full SSE streaming with tool use, thinking, and reasoning blocks |
| **Request optimizations** | ✅ | Network probe mocking, title generation skip, fast prefix detection, suggestion mode skip — saves latency and quota |
| **Dashboard** | ✅ | Live status, task stats, recent activity, model/provider info |
| **Web search & fetch** | ✅ | Built-in `web_search` (DuckDuckGo) and `web_fetch` tools — no MCP server needed |
| **Task / Kanban board** | ❌ | Create, manage, and track AI agent tasks with kanban-style board |
| **Memory vault** | ❌ | Notes, knowledge graph, and 3D graph visualization |
| **Cron / scheduled tasks** | ✅ | Recurring prompts on intervals (15m / 1h / 6h / 1d / 7d) |
| **Activity feed** | ❌ Partially done | Real-time activity logs with filtering (tasks, cron, errors, dreams) |
| **Discord bot** | ❌ Partially done | Run AI sessions via Discord |
| **Telegram bot** | ❌ Partially done  | Run AI sessions via Telegram |
| **Sub-agent system** | ✅ | Define agent personalities as `.md` files with keyword-based routing |
| **MCP server manager** | ✅ | Add and manage MCP servers from the dashboard |
| **Plugin marketplace** | ❌ Partially done | Curated plugins for Claude Code, skills, and more |
| **VS Code extension** | ❌ Partially done | Sidebar chat + dashboard, status bar, commands, auto-start |
| **Zed extension** | ✅ | Zed tasks, MCP server configuration, helper scripts |
| **Docker deployment** | ✅ | `docker compose up` for proxy + dashboard |
| **CLI tool** | ✅ | `spectre` command — send prompts, check status, list models |
| **Admin API** | ✅ | REST endpoints for config, validation, and status |
| **Graceful shutdown** | ✅ | SIGINT/SIGTERM handling |
| **Health checks** | ✅ | Docker healthcheck + `/health` endpoint |

---

## Aim & Scope

Spectre Proxy aims to be **the universal proxy layer** for AI coding agents and any Anthropic-compatible client. The core philosophy: **one endpoint, any provider, any model.**

> ⚠️ **Work in progress.** Currently only **OpenRouter and standard Claude models** are verified working. **OpenCode Go has known issues** with certain models. All other providers are implemented but **untested**. We need the community to help shake out bugs, test provider combinations, and improve compatibility. Every issue filed, every PR submitted, and every provider tested moves us forward.


The broader vision covers **every major AI provider and every major AI client**:

| Client | Status |
|--------|--------|
| **Claude Code CLI** | ❌ Partial support |
| **opencode** | ❌ Partial support |
| **VS Code (Claude Code extension)** | ❌ Started |
| **Zed** | ✅ Supported (native MCP) |
| **Cursor** | ❌ Not implemented |
| **Any Anthropic-compatible client** | ❌ Partial support |

---

## Screenshots

<div align="center">
  <table>
    <tr>
      <td align="center"><strong>Dashboard</strong></td>
      <td align="center"><strong>Tasks / Kanban</strong></td>
    </tr>
    <tr>
      <td><img src="public/assets/screenshots/dashboard.png" alt="Dashboard" width="380"></td>
      <td><img src="public/assets/screenshots/tasks.png" alt="Task Board" width="380"></td>
    </tr>
    <tr>
      <td align="center"><strong>Memory Vault</strong></td>
      <td align="center"><strong>Model Selection</strong></td>
    </tr>
    <tr>
      <td><img src="public/assets/screenshots/memory.png" alt="Memory Vault" width="380"></td>
      <td><img src="public/assets/screenshots/model-selection.png" alt="Model Selection" width="380"></td>
    </tr>
    <tr>
      <td align="center"><strong>Settings / Configuration</strong></td>
      <td align="center"><strong>Floating Bottom Bar</strong></td>
    </tr>
    <tr>
      <td><img src="public/assets/screenshots/settings.png" alt="Settings" width="380"></td>
      <td><img src="public/assets/screenshots/floating-bottom-bar.png" alt="Floating Bottom Bar" width="380"></td>
    </tr>
  </table>
</div>

---

## Prerequisites & Dependencies

Before you start, here's what you need:

### Required

| Dependency | Version | Notes |
|-----------|---------|-------|
| **Docker Desktop** (recommended) | Latest | Simplest setup — both proxy + dashboard in containers |
| **Or Go** | 1.26+ | For running the proxy directly |
| **Or Node.js / npm** | 24+ / 10+ | For running the dashboard directly |
| **API key** | — | At least one from a [supported provider](#supported-providers) |

### Optional but Helpful

| Dependency | Purpose | Notes |
|-----------|---------|-------|
| **Obsidian** | Memory vault | The vault graph visualizes markdown notes from an Obsidian vault at `~/.spectre-proxy/agent-vault/` |
| **Claude Code CLI** | IDE integration | The proxy intercepts Claude Code's API calls — install it separately for CLI use |
| **Discord account + bot token** | Discord bot | For remote AI sessions via Discord |
| **Telegram account + bot token** | Telegram bot | For remote AI sessions via Telegram |

### Per-Provider API Keys

Each provider needs its own API key. Set them in `~/.spectre-proxy/.env`:

```env
# Pick at least one:
OPENROUTER_API_KEY=sk-or-v1-...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
DEEPSEEK_API_KEY=sk-...
GROQ_API_KEY=gsk_...
MISTRAL_API_KEY=...
# ... see full list in Supported Providers below
```

Local-only providers (Ollama, LM Studio, llama.cpp) don't need a key.

---

## Quick Start

### 1. Clone & Run (Docker — Recommended)

```bash
git clone https://github.com/chrisbeckett/spectre-proxy.git
cd spectre-proxy
./setup.sh
```

The setup script will:
1. Check prerequisites (Docker / Go / Node.js)
2. Set up your shell profile with helpful commands (`spectre`, `spectre-dashboard`, `spectre-start`, `spectre-stop`)
3. Detect your IDE (VS Code, Zed) and configure the extension
4. Build and start everything
5. Print next steps

Or jump straight in:

```bash
# Set at least one API key
export OPENROUTER_API_KEY=sk-or-v1-...

# Start everything
bash docker/run.sh up
```

Once running:

- **Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Proxy API**: [http://localhost:8082](http://localhost:8082)
- **Health check**: `curl http://localhost:8082/health`

### 2. Or Run Directly (No Docker)

```bash
# Build the Go proxy
cd agent && go build -o ~/.spectre-proxy/bin/spectre-server ./cmd/spectre-server/
go build -o ~/.spectre-proxy/bin/spectre ./cmd/spectre/

# Install dashboard deps
cd .. && npm install

# Build dashboard
npm run build

# Start proxy
export SPECTRE_CC_DIR="$HOME/.spectre-proxy"
nohup ~/.spectre-proxy/bin/spectre-server > ~/.spectre-proxy/spectre-server.log 2>&1 &

# Start dashboard
nohup npx next start -p 3000 > ~/.spectre-proxy/dashboard.log 2>&1 &
```

### 3. Configure API Keys

Create `~/.spectre-proxy/.env`:

```env
# At least one API key required
OPENROUTER_API_KEY=sk-or-v1-...
# or
ANTHROPIC_API_KEY=sk-ant-...
# or
OPENAI_API_KEY=sk-...
# or any provider from the list below

# Default model (provider/model format)
MODEL=openrouter/anthropic/claude-sonnet-4
```

---

## Supported Providers

Spectre Proxy supports **17 provider backends** across two API types. See [test status](#currently-implemented-providers) below for which have been verified.

### Anthropic Messages API (Native)

| Provider | Config Key | Test Status | Docs |
|----------|-----------|-------------|------|
| **OpenRouter** | `OPENROUTER_API_KEY` | ✅ Working | [openrouter.ai](https://openrouter.ai) |
| **DeepSeek** | `DEEPSEEK_API_KEY` | ⏳ Untested | [platform.deepseek.com](https://platform.deepseek.com) |
| **Wafer** | `WAFER_API_KEY` | ⏳ Untested | [wafer.ai](https://wafer.ai) |
| **Kimi** | `KIMI_API_KEY` | ⏳ Untested | [platform.moonshot.ai](https://platform.moonshot.ai) |
| **Fireworks AI** | `FIREWORKS_API_KEY` | ⏳ Untested | [fireworks.ai](https://fireworks.ai) |
| **Z.ai** | `ZAI_API_KEY` | ⏳ Untested | [z.ai](https://z.ai) |
| **Ollama** (local) | — | ⏳ Untested | [ollama.com](https://ollama.com) |
| **LM Studio** (local) | — | ⏳ Untested | [lmstudio.ai](https://lmstudio.ai) |
| **llama.cpp** (local) | — | ⏳ Untested | [github.com/ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp) |

### OpenAI Chat Completions (Translated to Anthropic SSE)

| Provider | Config Key | Test Status | Docs |
|----------|-----------|-------------|------|
| **NVIDIA NIM** | `NVIDIA_NIM_API_KEY` | ⏳ Untested | [build.nvidia.com](https://build.nvidia.com) |
| **Gemini (Google AI Studio)** | `GEMINI_API_KEY` | ⏳ Untested | [aistudio.google.com](https://aistudio.google.com) |
| **Mistral** | `MISTRAL_API_KEY` | ⏳ Untested | [console.mistral.ai](https://console.mistral.ai) |
| **Codestral** | `CODESTRAL_API_KEY` | ⏳ Untested | [console.mistral.ai](https://console.mistral.ai) |
| **OpenCode Zen** | `OPENCODE_API_KEY` | ⏳ Untested | [opencode.ai](https://opencode.ai) |
| **OpenCode Go** | `OPENCODE_API_KEY` | ⚠️ Issues | [opencode.ai](https://opencode.ai) |
| **Cerebras** | `CEREBRAS_API_KEY` | ⏳ Untested | [cloud.cerebras.ai](https://cloud.cerebras.ai) |
| **Groq** | `GROQ_API_KEY` | ⏳ Untested | [console.groq.com](https://console.groq.com) |

---

## Provider Architecture

Each AI provider is implemented as an **independent Go package** under `agent/internal/providers/<name>/`, making it easy to add, modify, or remove providers without touching other code.

### How Providers Work

```
agent/internal/providers/
├── provider.go              # Provider interface + registry
├── factory.go               # ProviderFactories map + RegisterProvider()
├── anthropic/               # Base Anthropic Messages API transport (shared)
│   └── transport.go
├── openai/                  # Base OpenAI Chat Completions transport (shared)
│   ├── transport.go
│   ├── convert.go           # Anthropic→OpenAI request conversion
│   └── sse.go               # OpenAI→Anthropic SSE translation
├── openrouter/              # Individual provider packages
│   ├── provider.go          #   ─ wraps anthropic.Transport or openai.Transport
│   └── register.go          #   ─ self-registers via init()
├── deepseek/
├── kimi/
├── wafer/
├── fireworks/
├── zai/
├── ollama/
├── llamacpp/
├── lmstudio/
├── gemini/
├── mistral/
├── codestral/
├── nvidia_nim/
├── cerebras/
├── groq/
├── opencode/
└── ...
```

### Two Transport Backends

| Transport | Protocol | Providers |
|-----------|----------|-----------|
| **`anthropic`** | Native Anthropic Messages API (`/v1/messages`) | `deepseek`, `fireworks`, `kimi`, `openrouter`, `wafer`, `zai`, `ollama`, `llamacpp`, `lmstudio` |
| **`openai`** | OpenAI Chat Completions (`/v1/chat/completions`) → translated to Anthropic SSE | `cerebras`, `codestral`, `gemini`, `groq`, `mistral`, `nvidia_nim`, `opencode`, `opencode_go` |

### Adding a New Provider

1. Create a new package under `agent/internal/providers/<name>/`
2. Write `provider.go` — implement the `Provider` interface wrapping `anthropic.Transport` or `openai.Transport`
3. Write `register.go` — call `providers.RegisterProvider("name", New)` in `init()` for auto-registration
4. Add the provider ID + env key mapping in `config/providers.go` (for the admin UI catalog)
5. No changes needed to factory or server code — registration is automatic via Go `init()`

That's it. The provider self-registers at import time.

### Currently Implemented Providers

| Package | Provider | Transport | API Key Env Var | Build | Test Status |
|---------|----------|-----------|-----------------|-------|-------------|
| `openrouter/` | OpenRouter | `anthropic` | `OPENROUTER_API_KEY` | ✅ Built | ✅ Working |
| `deepseek/` | DeepSeek | `anthropic` | `DEEPSEEK_API_KEY` | ❌ | ⏳ Untested |
| `kimi/` | Kimi | `anthropic` | `KIMI_API_KEY` | ❌  | ⏳ Untested |
| `wafer/` | Wafer | `anthropic` | `WAFER_API_KEY` | ❌  | ⏳ Untested |
| `fireworks/` | Fireworks AI | `anthropic` | `FIREWORKS_API_KEY` |❌  | ⏳ Untested |
| `zai/` | Z.ai | `anthropic` | `ZAI_API_KEY` | ❌  | ⏳ Untested |
| `ollama/` | Ollama (local) | `anthropic` | — | ✅ Built | ⏳ Untested |
| `llamacpp/` | llama.cpp (local) | `anthropic` | — | ✅ Built | ⏳ Untested |
| `lmstudio/` | LM Studio (local) | `anthropic` | — | ✅ Built | ⏳ Untested |
| `gemini/` | Gemini | `openai` | `GEMINI_API_KEY` | ❌ | ⏳ Untested |
| `mistral/` | Mistral | `openai` | `MISTRAL_API_KEY` | ❌  | ⏳ Untested |
| `codestral/` | Codestral | `openai` | `CODESTRAL_API_KEY` | ❌  | ⏳ Untested |
| `nvidia_nim/` | NVIDIA NIM | `openai` | `NVIDIA_NIM_API_KEY` | ❌  | ⏳ Untested |
| `cerebras/` | Cerebras | `openai` | `CEREBRAS_API_KEY` | ❌ | ⏳ Untested |
| `groq/` | Groq | `openai` | `GROQ_API_KEY` | ❌  | ⏳ Untested |
| `opencode/` | OpenCode Zen | `openai` | `OPENCODE_API_KEY` | ✅ Built | ⚠️ Issues |
| `opencode_go/` | OpenCode Go | `openai` | `OPENCODE_API_KEY` | ✅ Built | ⚠️ Issues |

> 🧪 **Test status key:** `✅ Working` = verified working end-to-end · `⚠️ Issues` = code is in place but has known problems · `⏳ Untested` = implemented and compiles, but not yet tested with live API calls. If you try a provider and hit issues, please [open an issue](https://github.com/chrisbeckett/spectre-proxy/issues) with your model slug, error message, and any relevant logs — your report helps us and the whole community.

---

## Dashboard

The Spectre Proxy dashboard is a full-featured Next.js command center:

- **Live agent status** — Online/offline, model, provider, latency
- **Task statistics** — Running, completed, failed tasks at a glance
- **Kanban board** — Drag-and-drop task management
- **Memory vault** — Notes, knowledge graph, 3D graph visualization
- **Configuration** — API keys, model routing, proxy settings
- **Cron jobs** — Schedule recurring AI prompts
- **MCP servers** — Add and manage MCP connections
- **Sub-agents** — Define agent personalities as `.md` files
- **Activity feed** — Real-time log with type filtering
- **Plugin marketplace** — Browse and install curated plugins

---

## IDE Integrations

### VS Code Extension

A full VS Code extension with:

- **Sidebar panel** — Chat tab (streaming) + Dashboard tab (embedded)
- **Status bar** — Proxy status with green/yellow indicator
- **Commands** — Open Dashboard, Start/Stop/Restart proxy, Open Settings, Open Terminal
- **Auto-start** — Start proxy on VS Code launch
- **Live config** — Settings changes propagate in real-time

Install from `ide/vscode/`:

```bash
cd ide/vscode && npm install && npm run build
# Then in VS Code: Cmd+Shift+P → Developer: Install Extension from Location...
```

### Zed Extension

Zed tasks and MCP configuration:

```bash
# Copy .zed folder into any project
cp -r ide/zed/.zed /path/to/your/project/
```

Includes tasks for: Open Dashboard, Chat, Start/Stop proxy, Build, Test Health, View Logs, Open Memory Graph, Open Task Board, and more.

---

## CLI Usage

The `spectre` CLI tool provides quick terminal access:

```bash
spectre "your prompt"          # Send a single prompt
spectre                        # Launch interactive agent session
spectre status                 # Check proxy health
spectre models                 # List available models
spectre-dashboard              # Open dashboard in browser
spectre-start                  # Start proxy + dashboard
spectre-stop                   # Stop all services
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/v1/models` | GET | List available models |
| `/v1/messages` | POST | Send a message (streaming or non-streaming) |
| `/v1/messages/count_tokens` | POST | Estimate token count |
| `/admin/api/config` | GET | Get current config |
| `/admin/api/config/validate` | POST | Validate config changes |
| `/admin/api/config/apply` | POST | Apply config changes |
| `/admin/api/status` | GET | Server status |

---

## Contributing

Spectre Proxy is a community-driven project and **contributions are warmly welcome** — whether you're fixing a bug, adding a new provider, improving the dashboard, or writing documentation.

### How to Contribute

1. **Test a provider** — Pick a provider from the list, configure it, and run a few conversations. Open an issue with what worked and what didn't
2. **Report bugs & suggest features** — Open an [issue](https://github.com/chrisbeckett/spectre-proxy/issues)
3. **Add a new provider** — Implement the `Provider` interface — see [Provider Architecture](#provider-architecture) for the self-registration pattern
4. **Improve the dashboard** — The Next.js dashboard lives in `src/`
5. **Enhance the proxy** — The Go proxy lives in `agent/`
6. **Write IDE extensions** — VS Code (`ide/vscode/`) and Zed (`ide/zed/`) extensions welcome

### Development Setup

```bash
# Run the Go proxy directly
cd agent
go run ./cmd/spectre-server/

# In another terminal, run the dashboard
npm run dev
```

### Project Structure

```text
spectre-proxy/
├── agent/                   # Go proxy server
│   ├── cmd/                 # Entry points (spectre-server, spectre)
│   └── internal/            # Core logic
│       ├── config/          # Settings & provider catalog
│       ├── messaging/       # Discord & Telegram bots
│       ├── protocol/        # Anthropic protocol types
│       ├── providers/       # Provider implementations
│       ├── router/          # Model routing
│       ├── server/          # HTTP server & routes
│       └── tools/           # Web search & fetch
├── src/                     # Next.js dashboard
│   ├── app/                 # Pages (dashboard, tools, kanban, memory, activity)
│   ├── components/          # UI components
│   └── lib/                 # Utilities & vault
├── docker/                  # Docker configuration
├── ide/                     # IDE extensions
│   ├── vscode/              # VS Code extension
│   └── zed/                 # Zed extension
├── public/assets/screenshots/  # Screenshots
└── setup.sh                 # One-time setup script
```

### Code Quality

- Go proxy follows idiomatic Go patterns with clean separation of concerns
- Dashboard uses Next.js App Router, Tailwind CSS v4, and daisyUI
- Provider implementations extend either `anthropic.Transport` or `openai.Transport`
- All providers implement a common `Provider` interface for consistent behavior

### Looking for Help With

- 🧪 **Provider testing** — Pick a provider you use, run it through its paces, and report what works and what doesn't. This is the single biggest help right now
- 🐛 **Bug reports** — Hit a snag with a provider or feature? File an issue with details (model slug, error, logs)
- 🔌 **New providers** — Implement new providers using the self-registration pattern (see [Provider Architecture](#provider-architecture))
- 🎨 **Dashboard improvements** — Better visualizations, dark mode refinements, mobile responsiveness
- 🔧 **IDE integrations** — JetBrains, Emacs, Neovim extensions
- 🧪 **Automated tests** — Unit tests, integration tests, end-to-end smoke tests
- 📖 **Documentation** — Tutorials, video guides, configuration examples
- 🌍 **Internationalization** — Multi-language dashboard support

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">
  <p>Built with ❤️ for the AI coding community</p>
  <p>
    <a href="#quick-start">Quick Start</a> ·
    <a href="#prerequisites--dependencies">Prerequisites</a> ·
    <a href="#features">Features</a> ·
    <a href="#supported-providers">Providers</a> ·
    <a href="#provider-architecture">Architecture</a> ·
    <a href="#contributing">Contribute</a>
  </p>
</div>
