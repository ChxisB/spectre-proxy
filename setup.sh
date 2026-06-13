#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────
# Spectre Proxy — One-time setup script
#   - Checks prerequisites (Docker, Go, config)
#   - Configures your shell profile (~/.zshrc / ~/.bashrc)
#   - Builds and starts Docker containers
#   - Prints next steps
#
# Usage: ./setup.sh
# ───────────────────────────────────────────────────────────────
set -euo pipefail

# ─── Paths ──────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ─── Colors ─────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}⋅${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
fail()  { echo -e "${RED}✗${NC} $1"; }
header(){ echo -e "\n${CYAN}$1${NC}"; echo "──────────────────────────────"; }

# ─── Welcome ────────────────────────────────────────────────────
cat << 'WELCOME'

  ╔══════════════════════════════════════════════════╗
  ║                Spectre Proxy                     ║
  ║                One-time Setup                    ║
  ╚══════════════════════════════════════════════════╝

  This script will:
    • Check prerequisites
    • Set up your shell profile
    • Build and start services (Docker or direct)
    • Show you how to use everything

WELCOME

# ─── Install Mode ────────────────────────────────────────────────
header "Choose installation method"

echo "  How would you like to install Spectre Proxy?"
echo ""
echo "  1) Docker (recommended) — containers for proxy + dashboard"
echo "     Requires: Docker Desktop"
echo ""
echo "  2) Direct on machine — run proxy + dashboard natively"
echo "     Requires: Go, Node.js, npm"
echo ""
read -p "  Choice [1/2]: " INSTALL_MODE
echo ""

if [ "$INSTALL_MODE" = "2" ]; then
  INSTALL_DIRECT=true
  info "Installing directly on machine..."
else
  INSTALL_DIRECT=false
  info "Installing via Docker..."
fi

# ─── 1.5 IDE Selection ───────────────────────────────────────────
header "Choose your IDE"

# Detect available IDEs
AVAILABLE_IDES=()
command -v code &>/dev/null && AVAILABLE_IDES+=("vscode")
command -v zed &>/dev/null && AVAILABLE_IDES+=("zed")
ls /Applications/Antigravity.app &>/dev/null 2>&1 && AVAILABLE_IDES+=("antigravity")
ls "$HOME/Applications/Antigravity.app" &>/dev/null 2>&1 && AVAILABLE_IDES+=("antigravity")

IDE_CHOICE=""
if [ ${#AVAILABLE_IDES[@]} -eq 0 ]; then
  warn "No supported IDE detected. You can configure manually later."
  info "See ide/README.md for per-IDE setup instructions."
elif [ ${#AVAILABLE_IDES[@]} -eq 1 ]; then
  IDE_CHOICE="${AVAILABLE_IDES[0]}"
  ok "Detected: ${IDE_CHOICE^} — using it."
else
  echo "  Multiple IDEs detected:"
  echo ""
  for i in "${!AVAILABLE_IDES[@]}"; do
    echo "    $((i+1))) ${AVAILABLE_IDES[$i]^}"
  done
  echo "    ${#AVAILABLE_IDES[@]})+1) All of the above"
  echo ""
  read -p "  Which IDE to configure? [1-$(( ${#AVAILABLE_IDES[@]} + 1 ))]: " IDE_NUM
  echo ""
  if [ "$IDE_NUM" -gt "${#AVAILABLE_IDES[@]}" ] 2>/dev/null; then
    # Configure all detected
    IDE_CHOICE="all"
    info "Configuring all detected IDEs..."
  else
    IDE_CHOICE="${AVAILABLE_IDES[$((IDE_NUM-1))]}"
    info "Configuring: ${IDE_CHOICE^}"
  fi
fi

configure_ide() {
  local ide="$1"
  case "$ide" in
    vscode)
      configure_vscode_extension
      ;;
    zed)
      configure_zed_extension
      ;;
    antigravity)
      configure_antigravity_extension
      ;;
  esac
}

# ─── IDE Configuration Helpers ──────────────────────────────────

configure_vscode_extension() {
  header "Configuring VS Code extension"

  local ext_src="$SCRIPT_DIR/ide/vscode"
  local ext_name="spectre-proxy"
  local ext_dir="$HOME/.vscode/extensions/$ext_name"

  # ── Build the extension ──
  if [ ! -f "$ext_src/dist/extension.js" ]; then
    info "Building VS Code extension..."
    cd "$ext_src"
    npm install --silent 2>&1 | tail -3
    npm run build 2>&1 | tail -3
    cd "$SCRIPT_DIR"
    ok "Extension built"
  else
    ok "Extension already built (dist/extension.js exists)"
  fi

  # ── Install into VS Code extensions folder ──
  info "Installing extension into VS Code..."
  mkdir -p "$ext_dir"
  cp -R "$ext_src/package.json" "$ext_src/dist" "$ext_src/resources" "$ext_dir/" 2>/dev/null || true
  # Copy images dir if it has content
  if [ -d "$ext_src/images" ] && [ "$(ls -A "$ext_src/images" 2>/dev/null)" ]; then
    cp -R "$ext_src/images" "$ext_dir/" 2>/dev/null || true
  fi
  ok "Extension installed → $ext_dir"

  # ── Write proxy config to global VS Code settings ──
  local vscode_settings="$HOME/Library/Application Support/Code/User/settings.json"
  if [ ! -f "$vscode_settings" ]; then
    vscode_settings="$HOME/.config/Code/User/settings.json"
  fi

  if [ -f "$vscode_settings" ]; then
    info "Updating VS Code settings: $vscode_settings"
    # Use python or node to merge JSON safely
    if command -v python3 &>/dev/null; then
      python3 - "$vscode_settings" << 'PYEOF'
import json, sys
path = sys.argv[1]
try:
    with open(path) as f:
        settings = json.load(f)
except:
    settings = {}
settings["spectre-proxy.proxyPort"] = 8082
settings["spectre-proxy.dashboardUrl"] = "http://localhost:3000"
settings["spectre-proxy.proxyApiKey"] = "spectre-proxy"
with open(path, "w") as f:
    json.dump(settings, f, indent=2)
print("OK")
PYEOF
      ok "Proxy config written to VS Code settings"
    else
      warn "python3 not found — could not auto-write settings.json"
      info "Add these to your VS Code settings manually:"
      echo '  "spectre-proxy.proxyPort": 8082'
      echo '  "spectre-proxy.dashboardUrl": "http://localhost:3000"'
      echo '  "spectre-proxy.proxyApiKey": "spectre-proxy"'
    fi
  else
    warn "VS Code settings.json not found at expected paths."
    info "Add these to your VS Code settings manually:"
    echo '  "spectre-proxy.proxyPort": 8082'
    echo '  "spectre-proxy.dashboardUrl": "http://localhost:3000"'
    echo '  "spectre-proxy.proxyApiKey": "spectre-proxy"'
  fi

  # ── Try code --install-extension as fallback ──
  if command -v code &>/dev/null; then
    info "Also running code --install-extension for good measure..."
    (cd "$ext_src" && code --install-extension . --force 2>&1) || true
  fi

  echo ""
  ok "VS Code extension configured!"
  info "Restart VS Code if it's running. The Spectre icon will appear in the activity bar."
}

configure_zed_extension() {
  header "Configuring Zed extension"

  local mcp_json="$SCRIPT_DIR/ide/zed/.zed/mcp.json"

  if [ ! -f "$mcp_json" ]; then
    warn "mcp.json not found at $mcp_json"
    return
  fi

  # Determine proxy port from install type
  local proxy_port=8082
  if [ "$INSTALL_DIRECT" = true ]; then
    # Could read from ~/.spectre-proxy/.env if user set custom port
    if [ -f "$HOME/.spectre-proxy/.env" ]; then
      local custom_port
      custom_port=$(grep -oP 'PROXY_PORT[=:]\s*\K\d+' "$HOME/.spectre-proxy/.env" 2>/dev/null || echo "")
      [ -n "$custom_port" ] && proxy_port="$custom_port"
    fi
  fi

  info "Setting proxy port to $proxy_port in mcp.json..."

  if command -v python3 &>/dev/null; then
    python3 - "$mcp_json" "$proxy_port" << 'PYEOF'
import json, sys
path = sys.argv[1]
port = sys.argv[2]
try:
    with open(path) as f:
        data = json.load(f)
except:
    data = {"mcp": []}
# Update existing or add new
updated = False
for server in data.get("mcp", []):
    if server.get("name") == "Spectre Proxy":
        server["url"] = f"http://127.0.0.1:{port}/v1/messages"
        updated = True
        break
if not updated:
    data.setdefault("mcp", []).append({
        "name": "Spectre Proxy",
        "url": f"http://127.0.0.1:{port}/v1/messages",
        "headers": {
            "Content-Type": "application/json",
            "x-api-key": "spectre-proxy"
        }
    })
with open(path, "w") as f:
    json.dump(data, f, indent=2)
print("OK")
PYEOF
    ok "mcp.json updated with port $proxy_port"
  else
    warn "python3 not found — updating mcp.json manually with sed..."
    # Fallback: just rewrite the file
    cat > "$mcp_json" << MCPJSON
{
  "mcp": [
    {
      "name": "Spectre Proxy",
      "url": "http://127.0.0.1:${proxy_port}/v1/messages",
      "headers": {
        "Content-Type": "application/json",
        "x-api-key": "spectre-proxy"
      }
    }
  ]
}
MCPJSON
    ok "mcp.json rewritten with port $proxy_port"
  fi

  echo ""
  ok "Zed extension configured!"
  info "Copy the .zed folder into any project to use Spectre MCP:"
  echo "  cp -r $SCRIPT_DIR/ide/zed/.zed /path/to/your/project/"
  echo ""
  info "Or add the MCP server to your global Zed settings:"
  echo "  Cmd+Shift+P → 'zed: open settings' → paste the mcp array from $mcp_json"
}

configure_antigravity_extension() {
  header "Antigravity"

  ok "Antigravity detected!"
  info "Auto-config for Antigravity is not yet supported."
  info "Please configure manually — see ide/README.md for details."
  info ""
  info "You'll need to point it at the Spectre proxy:"
  echo "  Proxy URL:  http://127.0.0.1:8082/v1/messages"
  echo "  API Key:    spectre-proxy (x-api-key header)"
}

# ─── Apply IDE config ────────────────────────────────────────────
if [ -n "$IDE_CHOICE" ]; then
  if [ "$IDE_CHOICE" = "all" ]; then
    for ide in "${AVAILABLE_IDES[@]}"; do
      configure_ide "$ide"
    done
  else
    configure_ide "$IDE_CHOICE"
  fi
fi

# ─── 1. Prerequisites ────────────────────────────────────────────
header "1. Checking prerequisites"

if [ "$INSTALL_DIRECT" = true ]; then
  # ── Go (required for direct) ──
  if ! command -v go &>/dev/null; then
    fail "Go is not installed. Install it first:"
    echo "  https://go.dev/dl/"
    exit 1
  fi
  ok "Go $(go version | grep -oP 'go[0-9]+\.[0-9]+(\.[0-9]+)?') installed"

  # ── Node.js ──
  if ! command -v node &>/dev/null; then
    fail "Node.js is not installed. Install it first:"
    echo "  https://nodejs.org/"
    exit 1
  fi
  ok "Node.js $(node --version) installed"

  if ! command -v npm &>/dev/null; then
    fail "npm is not installed."
    exit 1
  fi
  ok "npm $(npm --version) installed"
else
  # ── Docker ──
  if ! command -v docker &>/dev/null; then
    fail "Docker is not installed."
    echo "  Install Docker Desktop first:"
    echo "  https://docs.docker.com/desktop/install/mac-install/"
    exit 1
  fi
  ok "Docker installed ($(docker --version))"

  if ! docker info &>/dev/null 2>&1; then
    fail "Docker is not running."
    echo "  Start Docker Desktop and try again."
    exit 1
  fi
  ok "Docker daemon is running"

  if ! docker compose version &>/dev/null 2>&1; then
    fail "docker compose (v2) is not available."
    echo "  Update Docker Desktop to a version that includes Compose v2."
    exit 1
  fi
  ok "docker compose available ($(docker compose version --short 2>/dev/null || echo 'v2'))"
fi

# ── Config directory ──
SPECTRE_DIR="$HOME/.spectre-proxy"
mkdir -p "$SPECTRE_DIR/bin"

if [ -d "$SPECTRE_DIR" ]; then
  ok "Config directory: $SPECTRE_DIR"
else
  # shouldn't happen since we just created it, but just in case
  info "Created $SPECTRE_DIR"
fi

# ── .env file ──
ENV_FILE="$SPECTRE_DIR/.env"
NEEDS_API_KEY=false

if [ ! -f "$ENV_FILE" ]; then
  warn "No API keys configured yet."
  echo ""
  echo "  You need at least one API key to use Spectre Proxy."
  echo "  Popular providers:"
  echo "    OpenRouter:   https://openrouter.ai/keys"
  echo "    Anthropic:    https://console.anthropic.com/"
  echo "    OpenAI:       https://platform.openai.com/api-keys"
  echo ""
  read -p "  Create ~/.spectre-proxy/.env now? [Y/n] " -n 1 -r REPLY
  echo
  if [[ -z "$REPLY" || "$REPLY" =~ ^[Yy]$ ]]; then
    cat > "$ENV_FILE" << 'ENVEOF'
# ─── Spectre Proxy Configuration ──────────────────────────────
# Uncomment and set at least one API key below.
#
# Get keys from:
#   OpenRouter: https://openrouter.ai/keys
#   Anthropic:  https://console.anthropic.com/
#   OpenAI:     https://platform.openai.com/api-keys
#   Google:     https://aistudio.google.com/apikey
#   DeepSeek:   https://platform.deepseek.com/api_keys
#   Groq:       https://console.groq.com/keys
#   Mistral:    https://console.mistral.ai/api-keys/

# OPENROUTER_API_KEY=sk-or-v1-...
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# GEMINI_API_KEY=...
# DEEPSEEK_API_KEY=sk-...
# GROQ_API_KEY=gsk_...
# MISTRAL_API_KEY=...

# Default model (supports "provider/model" format)
MODEL=openrouter/anthropic/claude-sonnet-4
ENVEOF
    echo ""
    info "Created $ENV_FILE"
    echo "  Edit it now to add your API key(s), then re-run ./setup.sh"
    echo ""
    ok "Run this to open it:"
    echo "    open $ENV_FILE"
    echo ""
    exit 0
  else
    warn "Skipping .env creation — you can add keys later with: spectre configure"
    NEEDS_API_KEY=true
  fi
fi
ok "Config file: $ENV_FILE"

# ── Check for at least one key (basic heuristic) ──
if [ -f "$ENV_FILE" ]; then
  if ! grep -qE '^[^#]*=(sk-|gsk_|AIza)' "$ENV_FILE" 2>/dev/null; then
    warn "No API keys seem to be set in $ENV_FILE"
    echo "  The agent will start but may not be able to call providers."
    echo "  Edit it with: open $ENV_FILE"
    echo ""
  fi
fi

# ── Build CLI from Go source ──
build_spectre_cli() {
  local agent_dir="$SCRIPT_DIR/agent"
  if [ ! -f "$agent_dir/go.mod" ]; then
    warn "Go source not found at $agent_dir — cannot build CLI."
    return 1
  fi
  if ! command -v go &>/dev/null; then
    warn "Go is not installed — cannot build CLI."
    return 1
  fi
  info "Building spectre CLI from source..."
  mkdir -p "$SPECTRE_DIR/bin"
  if CGO_ENABLED=0 go build -o "$SPECTRE_DIR/bin/spectre" "$agent_dir/cmd/spectre/" 2>&1; then
    chmod +x "$SPECTRE_DIR/bin/spectre"
    ok "Built spectre CLI → $SPECTRE_DIR/bin/spectre"
  else
    warn "Failed to build spectre CLI from source."
    return 1
  fi
}

# ── Check / Build spectre CLI binary ──
header "2. Checking Spectre CLI"

SPECTRE_BIN="$SPECTRE_DIR/bin/spectre"

if command -v spectre &>/dev/null; then
  SPECTRE_PATH="$(which spectre)"
  # Check if it's the Go-built CLI (built from this repo) vs a pre-existing binary
  if "$SPECTRE_PATH" --version 2>/dev/null | grep -q "spectre v"; then
    ok "spectre CLI found at: $SPECTRE_PATH"
  else
    warn "Existing spectre CLI at $SPECTRE_PATH may be a different version."
    echo "  Building the latest CLI from source..."
    build_spectre_cli
  fi
else
  warn "spectre CLI not found on PATH"
  echo "  Building from source..."
  build_spectre_cli
fi

# ─── Shell Profile Setup ────────────────────────────────────────
header "3. Configuring shell profile"

# Detect profile file
PROFILE_FILE=""
if [[ "$SHELL" == */zsh ]]; then
  PROFILE_FILE="$HOME/.zshrc"
elif [[ "$SHELL" == */bash ]]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    PROFILE_FILE="$HOME/.bash_profile"
  else
    PROFILE_FILE="$HOME/.bashrc"
  fi
else
  PROFILE_FILE="$HOME/.profile"
fi

PROFILE_UPDATED=false

# Ensure profile exists
touch "$PROFILE_FILE"
PROFILE_RELOAD_CMD="source $PROFILE_FILE"

# ── PATH entry ──
if ! grep -q '\.spectre-proxy/bin' "$PROFILE_FILE" 2>/dev/null; then
  cat >> "$PROFILE_FILE" << 'PROFILEPATH'

# Spectre Proxy
export PATH="$PATH:$HOME/.spectre-proxy/bin"
PROFILEPATH
  ok "Added ~/.spectre-proxy/bin to PATH in $PROFILE_FILE"
  PROFILE_UPDATED=true
else
  ok "PATH already configured in $PROFILE_FILE"
fi

# ── spectre-dashboard function ──
if ! grep -q 'spectre-dashboard' "$PROFILE_FILE" 2>/dev/null; then
  cat >> "$PROFILE_FILE" << 'PROFILEDASH'

# Open Spectre Proxy dashboard in browser (requires containers running)
spectre-dashboard() {
  open http://localhost:3000
}
PROFILEDASH
  ok "Added spectre-dashboard function to $PROFILE_FILE"
  PROFILE_UPDATED=true
else
  ok "spectre-dashboard already configured in $PROFILE_FILE"
fi

# ── Reload hint ──
if [ "$PROFILE_UPDATED" = true ]; then
  echo ""
  info "To apply changes in this terminal, run:"
  echo "    $PROFILE_RELOAD_CMD"
  echo ""
  info "Or open a new terminal window."
fi

# ─── Port Conflict & Launchd Agent Check ──────────────────────
header "4. Checking for port conflicts"

PORTS_CLEAR=true

check_port() {
  local port=$1 name=$2
  local line
  line=$(lsof -i :"$port" -sTCP:LISTEN -Pn 2>/dev/null | grep LISTEN | head -1)
  if [ -n "$line" ]; then
    local pid
    pid=$(echo "$line" | awk '{print $2}')
    local comm
    comm=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
    # Skip Docker Desktop processes — they manage ports internally
    if echo "$comm" | grep -qi "docker"; then
      return 0
    fi
    warn "Port $port is in use by PID $pid ($comm) — needed for $name"
    return 1
  fi
  return 0
}

check_launchd() {
  local label=$1
  if launchctl list | grep -q "$label" 2>/dev/null; then
    return 0  # exists
  fi
  return 1
}

NEEDS_KILL=false

if ! check_port 8082 "agent proxy"; then
  echo "  The Docker agent needs port 8082."
  if check_launchd "io.spectre.spectre-server"; then
    echo "  → This is the launchd service (auto-starts at login)."
    echo "    It will be unloaded and managed by Docker instead."
  fi
  NEEDS_KILL=true
fi

if ! check_port 3000 "dashboard"; then
  echo "  The Docker dashboard needs port 3000."
  if check_launchd "io.spectre.dashboard"; then
    echo "  → This is the launchd service (auto-starts at login)."
  fi
  NEEDS_KILL=true
fi

if [ "$NEEDS_KILL" = true ]; then
  echo ""
  read -p "  Free these ports now? [Y/n] " -n 1 -r REPLY
  echo
  if [[ -z "$REPLY" || "$REPLY" =~ ^[Yy]$ ]]; then
    echo ""
    # Unload launchd agents
    for label in io.spectre.spectre-server io.spectre.dashboard; do
      if check_launchd "$label"; then
        info "Unloading launchd agent: $label"
        launchctl bootout gui/$(id -u)/"$label" 2>/dev/null || \
          launchctl unload gui/$(id -u)/"$label" 2>/dev/null || true
        sleep 1
        if check_launchd "$label"; then
          warn "Could not unload $label — you may need to stop it manually"
        else
          ok "Unloaded $label"
        fi
      fi
    done
    # Kill any remaining processes on conflict ports (skip Docker)
    for port in 8082 3000; do
      line=$(lsof -i :"$port" -sTCP:LISTEN -Pn 2>/dev/null | grep LISTEN | head -1)
      if [ -n "$line" ]; then
        pid=$(echo "$line" | awk '{print $2}')
        comm=$(ps -p "$pid" -o comm= 2>/dev/null || echo "")
        if ! echo "$comm" | grep -qi "docker"; then
          info "Killing process $pid on port $port..."
          kill "$pid" 2>/dev/null || true
          sleep 1
        fi
      fi
    done
    echo ""
    # Verify — don't fail if Docker is involved, just warn
    ALL_CLEAR=true
    check_port 8082 "agent proxy" || ALL_CLEAR=false
    check_port 3000 "dashboard" || ALL_CLEAR=false
    if [ "$ALL_CLEAR" = true ]; then
      ok "All ports are now free"
    else
      warn "Some ports are still in use — you may need to free them manually if containers fail to start"
    fi
  else
    warn "Port conflicts may prevent containers from starting."
    echo "  Free them manually with:"
    echo "    launchctl bootout gui/$(id -u)/io.spectre.spectre-server"
    echo "    launchctl bootout gui/$(id -u)/io.spectre.dashboard"
    echo "    kill \$(lsof -ti :8082) \$(lsof -ti :3000)"
    echo ""
  fi
fi

# ─── Build & Start Services ────────────────────────────────────
if [ "$INSTALL_DIRECT" = true ]; then
  header "5. Building and starting services (direct)"

  echo "  This will build the Go proxy + dashboard and start them."
  echo "  First time may take a few minutes ⏳"
  echo ""

  read -p "  Build and start now? [Y/n] " -n 1 -r REPLY
  echo
  if [[ -z "$REPLY" || "$REPLY" =~ ^[Yy]$ ]]; then
    echo ""
    info "Building Go proxy server..."
    cd "$SCRIPT_DIR/agent"
    go build -o "$SPECTRE_DIR/bin/spectre-server" ./cmd/spectre-server/
    ok "Built spectre-server"

    info "Building CLI..."
    go build -o "$SPECTRE_DIR/bin/spectre" ./cmd/spectre/
    ok "Built spectre CLI"

    info "Installing dashboard dependencies..."
    cd "$SCRIPT_DIR"
    npm install --silent
    ok "npm dependencies installed"

    info "Building dashboard..."
    npm run build
    ok "Dashboard built"

    echo ""
    info "Starting proxy server in background..."
    export SPECTRE_PROXY_DIR="$SPECTRE_DIR"
    nohup "$SPECTRE_DIR/bin/spectre-server" > "$SPECTRE_DIR/spectre-server.log" 2>&1 &
    echo $! > "$SPECTRE_DIR/spectre-server.pid"
    sleep 2

    info "Starting dashboard server in background..."
    nohup npx next start -p 3000 > "$SPECTRE_DIR/dashboard.log" 2>&1 &
    echo $! > "$SPECTRE_DIR/dashboard.pid"
    echo ""

    # Add start/stop functions to shell profile
    if ! grep -q 'spectre-start' "$PROFILE_FILE" 2>/dev/null; then
      cat >> "$PROFILE_FILE" << 'PROFILESTART'

# Spectre Proxy — start/stop services
spectre-start() {
  echo "Starting Spectre proxy..."
  nohup "$HOME/.spectre-proxy/bin/spectre-server" > "$HOME/.spectre-proxy/spectre-server.log" 2>&1 &
  echo $! > "$HOME/.spectre-proxy/spectre-server.pid"
  echo "Starting Spectre dashboard..."
  cd "$SPECTRE_PROXY_DIR" 2>/dev/null || cd "$HOME/Spectre Proxy/command-center-v2"
  nohup npx next start -p 3000 > "$HOME/.spectre-proxy/dashboard.log" 2>&1 &
  echo $! > "$HOME/.spectre-proxy/dashboard.pid"
  echo "Services started."
}
spectre-stop() {
  [ -f "$HOME/.spectre-proxy/spectre-server.pid" ] && kill $(cat "$HOME/.spectre-proxy/spectre-server.pid") 2>/dev/null; true
  [ -f "$HOME/.spectre-proxy/dashboard.pid" ] && kill $(cat "$HOME/.spectre-proxy/dashboard.pid") 2>/dev/null; true
  echo "Services stopped."
}
PROFILESTART
      PROFILE_UPDATED=true
    fi

    ok "Services started!"
  else
    info "Skipping build. Build later with:"
    echo "    cd agent && go build -o ~/.spectre-proxy/bin/spectre-server ./cmd/spectre-server/"
    echo "    cd agent && go build -o ~/.spectre-proxy/bin/spectre ./cmd/spectre/"
    echo "    npm install && npm run build"
    echo "    spectre-start    # start both servers"
  fi

else
  header "5. Building and starting Docker containers"

  echo "  This will build the agent proxy and dashboard via Docker."
  echo "  First time may take a few minutes ⏳"
  echo ""

  read -p "  Build and start containers now? [Y/n] " -n 1 -r REPLY
  echo
  if [[ -z "$REPLY" || "$REPLY" =~ ^[Yy]$ ]]; then
    echo ""
    bash "$SCRIPT_DIR/docker/run.sh" up
    echo ""

    echo "  Waiting for proxy to become healthy..."
    for i in {1..10}; do
      HEALTHY=$(docker inspect --format='{{.State.Health.Status}}' spectre-proxy 2>/dev/null || echo "starting")
      if [ "$HEALTHY" = "healthy" ]; then
        break
      fi
      sleep 2
    done

    if docker ps --filter "name=spectre-dashboard" --filter "status=running" --format "{{.Names}}" | grep -q "spectre-dashboard"; then
      ok "Dashboard container is running"
    else
      warn "Dashboard container may still be starting..."
    fi

    if docker inspect --format='{{.State.Health.Status}}' spectre-proxy 2>/dev/null | grep -q "healthy"; then
      ok "Proxy is healthy"
    else
      warn "Proxy may still be starting — check with: ./docker/run.sh status"
    fi
  else
    info "Skipping container build. Start them later with:"
    echo "    bash $SCRIPT_DIR/docker/run.sh up"
  fi
fi

# ─── ─── Final Summary ──────────────────────────────────────────
header "6. Setup complete!"

if [ "$INSTALL_DIRECT" = true ]; then
  cat << SUMMARY

  ─────────────────────────────────────────────
   Spectre Proxy is ready to use! (Direct install)

   Terminal commands:
     spectre "your prompt"          CLI (single prompt)
     spectre                        Launch interactive agent
     spectre-dashboard              Open dashboard in browser
     spectre-start                  Start proxy + dashboard
     spectre-stop                   Stop proxy + dashboard
     spectre status                 Check proxy health
     spectre models                 List models

   URLs:
     Dashboard:  http://localhost:3000
     Proxy API:  http://localhost:8082

   Configuration:
     ~/.spectre-proxy/.env             API keys and settings
     ~/.spectre-proxy/agents/          Sub-agent definitions (.md)
     ~/.spectre-proxy/mcp.json         MCP server config

   Logs:
     ~/.spectre-proxy/spectre-server.log
     ~/.spectre-proxy/dashboard.log
  ─────────────────────────────────────────────

SUMMARY
else
  cat << SUMMARY

  ─────────────────────────────────────────────
   Spectre Proxy is ready to use! (Docker)

   Terminal commands:
     spectre "your prompt"          CLI (single prompt)
     spectre                        Launch interactive agent
     spectre-dashboard              Open dashboard in browser
     bash docker/run.sh status      Check container status
     bash docker/run.sh down        Stop containers
     bash docker/run.sh logs        View logs

   URLs:
     Dashboard:  http://localhost:3000
     Proxy API:  http://localhost:8082

   Configuration:
     ~/.spectre-proxy/.env             API keys and settings
     ~/.spectre-proxy/agents/          Sub-agent definitions (.md)
     ~/.spectre-proxy/mcp.json         MCP server config

  ─────────────────────────────────────────────

SUMMARY
fi
