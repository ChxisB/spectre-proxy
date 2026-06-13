# Spectre Proxy — Editor Extensions

## VS Code Extension

### Install from source

1. Install dependencies and build:
   ```bash
   cd extensions/vscode-spectre-proxy
   npm install
   npm run build
   ```

2. In VS Code, press `Cmd+Shift+P` → "Developer: Install Extension from Location..."
3. Select the `extensions/vscode-spectre-proxy` folder

### Features
- **Sidebar Panel** — Chat and Dashboard in a single sidebar view:
  - **Chat tab** — Full streaming chat with Spectre Proxy, matching the dashboard experience
  - **Dashboard tab** — Embedded live dashboard (responsive: shows full iframe when wide enough, compact fallback when narrow)
- **Status bar** — shows proxy status with color indicator (green = online, yellow = offline)
- **Click status bar** to open the dashboard in browser
- **Commands** (`Cmd+Shift+P` → "Spectre Proxy"):
  - `Open Dashboard` — opens dashboard in browser
  - `Start/Stop/Restart Proxy` — manage the Go proxy process
  - `Open Settings` — opens VS Code settings for Spectre Proxy
  - `Open Terminal` — opens a terminal in the project directory
- **Auto-start** — enable `spectre-proxy.autoStart` in settings to start the proxy on launch
- **Config change detection** — settings changes propagate to the webview panel in real-time

### Chat
The sidebar Chat tab connects directly to the Spectre Proxy (`/v1/messages` endpoint) using the Anthropic-compatible streaming format. It:
- Uses configurable proxy URL, port, and API key from settings
- Streams responses token-by-token with proper SSE parsing
- Maintains conversation history during the session
- Auto-detects the configured model from settings

### Dashboard
The Dashboard tab provides an embedded view of the Spectre Proxy dashboard:
- **Wide panels (>420px)**: Loads the full dashboard in an iframe (live, interactive)
- **Narrow panels (<420px)**: Shows a compact fallback with quick navigation links
- Responsive resizing adapts as you resize the VS Code sidebar
- "Open in Browser" button for full-screen view

### Settings
| Setting | Default | Description |
|---------|---------|-------------|
| `spectre-proxy.proxyPort` | `8082` | Port for the Spectre proxy |
| `spectre-proxy.dashboardUrl` | `http://localhost:3000` | Dashboard URL |
| `spectre-proxy.proxyBinPath` | `""` | Path to `spectre-server` binary (auto-detects) |
| `spectre-proxy.autoStart` | `false` | Auto-start proxy on VS Code launch |
| `spectre-proxy.proxyApiKey` | `spectre-proxy` | API key sent to the proxy |

---

## Zed Extension

### Install

The Zed extension provides project-level task and MCP configuration for Spectre Proxy.
Copy the `.zed/` folder into any project:

```bash
cp -r extensions/zed-spectre-proxy/.zed /path/to/your/project/
```

Or reference it directly from the spectre-proxy project.

### Features

#### Tasks (Cmd+Shift+P → task name)
| Task | Description |
|------|-------------|
| `Spectre Proxy: Open Dashboard` | Open dashboard in browser |
| `Spectre Proxy: Chat (Quick Message)` | Send a test message via the proxy |
| `Spectre Proxy: Start Proxy` | Start proxy via `go run` |
| `Spectre Proxy: Start Proxy (Built Binary)` | Start proxy from compiled binary |
| `Spectre Proxy: Stop Proxy` | Kill the proxy process |
| `Spectre Proxy: Restart Proxy` | Restart the proxy |
| `Spectre Proxy: Build Proxy` | Build the Go binary |
| `Spectre Proxy: Test Health` | Check health endpoint |
| `Spectre Proxy: View Logs` | View proxy log files |
| `Spectre Proxy: Open Memory Graph` | Open memory vault in browser |
| `Spectre Proxy: Open Task Board` | Open kanban board in browser |
| `Spectre Proxy: Open Terminal` | Open terminal in project dir |
| `Spectre Proxy: Open Settings` | Open tools/config page |

#### MCP Server
Zed's AI assistant can call the Spectre proxy via MCP. The endpoint is pre-configured at `http://127.0.0.1:8082/v1/messages` with the Anthropic-compatible API format.

#### Helper Script
A `spectre.sh` helper script is provided for quick terminal operations:
```bash
./ide/zed/spectre.sh chat "Hello, how are you?"    # Send chat message
./ide/zed/spectre.sh stream "Tell me a story"       # Stream a response
./ide/zed/spectre.sh status                         # Check proxy health
./ide/zed/spectre.sh dashboard                      # Open dashboard
```
