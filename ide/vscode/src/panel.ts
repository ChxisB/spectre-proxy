import * as vscode from "vscode";

interface ProxyActions {
  checkProxyStatus: () => Promise<boolean>;
  startProxy: () => Promise<void>;
  stopProxy: () => Promise<void>;
  openDashboard: () => Promise<void>;
  getConfig: () => {
    proxyPort: number;
    dashboardUrl: string;
    proxyApiKey: string;
    proxyBinPath: string;
    autoStart: boolean;
  };
}

export class SpectreChatViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly proxy: ProxyActions
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this._getHtml();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case "checkStatus":
          const ok = await this.proxy.checkProxyStatus();
          webviewView.webview.postMessage({ type: "statusResult", ok });
          break;
        case "startProxy":
          await this.proxy.startProxy();
          webviewView.webview.postMessage({ type: "statusResult", ok: true });
          break;
        case "stopProxy":
          await this.proxy.stopProxy();
          webviewView.webview.postMessage({ type: "statusResult", ok: false });
          break;
        case "openDashboard":
          await this.proxy.openDashboard();
          break;
        case "dashNavigate":
          // Open dashboard at specific path in browser
          const dashConfig = this.proxy.getConfig();
          vscode.env.openExternal(
            vscode.Uri.parse(`${dashConfig.dashboardUrl}${message.path || ""}`)
          );
          break;
        case "chat":
          await this._handleChat(message, webviewView);
          break;
        case "getConfig":
          webviewView.webview.postMessage({
            type: "configResult",
            config: this.proxy.getConfig(),
          });
          break;
      }
    });
  }

  /** Call when extension settings change */
  updateConfig(config: ReturnType<ProxyActions["getConfig"]>) {
    if (this._view) {
      this._view.webview.postMessage({ type: "configResult", config });
    }
  }

  private async _handleChat(msg: any, view: vscode.WebviewView) {
    const config = this.proxy.getConfig();
    const proxyUrl = `http://127.0.0.1:${config.proxyPort}`;
    const model = msg.model || undefined;

    // Convert messages from frontend format to Anthropic API format
    // Frontend sends: { role, content: string }
    // Proxy expects: { role, content: [{ type: "text", text: string }] }
    const anthropicMessages = (msg.messages || []).map((m: any) => ({
      role: m.role,
      content: [{ type: "text" as const, text: m.content }],
    }));

    try {
      const resp = await fetch(`${proxyUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.proxyApiKey ? { "x-api-key": config.proxyApiKey } : {}),
        },
        body: JSON.stringify({
          model: model || "",
          messages: anthropicMessages,
          stream: true,
          max_tokens: 4096,
        }),
      });

      if (!resp.ok) {
        const body = await resp.text().catch(() => "unknown error");
        view.webview.postMessage({ type: "chatError", error: `HTTP ${resp.status}: ${body}` });
        return;
      }

      if (!resp.body) {
        view.webview.postMessage({ type: "chatError", error: "Empty response body" });
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);

              // Anthropic SSE format:
              // - content_block_delta: delta.text
              // - message_start: message.model
              // - message_delta: usage info
              if (
                parsed.type === "content_block_delta" &&
                parsed.delta?.type === "text_delta"
              ) {
                content += parsed.delta.text || "";
                view.webview.postMessage({ type: "chatDelta", content });
              }
            } catch {
              // skip malformed JSON lines
            }
          }
        }
      }

      view.webview.postMessage({ type: "chatDone", content });
    } catch (err: any) {
      view.webview.postMessage({ type: "chatError", error: err.message });
    }
  }

  private _getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  :root {
    --bg: var(--vscode-sideBar-background, #1e1e1e);
    --fg: var(--vscode-sideBar-foreground, #d4d4d4);
    --muted: var(--vscode-descriptionForeground, #858585);
    --accent: var(--vscode-focusBorder, #007acc);
    --border: var(--vscode-sideBar-border, #3c3c3c);
    --btn-bg: var(--vscode-button-background, #0e639c);
    --btn-fg: var(--vscode-button-foreground, #fff);
    --btn-hover: var(--vscode-button-hoverBackground, #1177d1);
    --input-bg: var(--vscode-input-background, #3c3c3c);
    --input-fg: var(--vscode-input-foreground, #d4d4d4);
    --input-border: var(--vscode-input-border, #3c3c3c);
    --bubble-bg: var(--vscode-textCodeBlock-background, #2a2a2a);
    --user-bg: var(--vscode-button-background, #0e639c);
    --user-fg: var(--vscode-button-foreground, #fff);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
    font-family: var(--vscode-font-family, sans-serif);
    font-size: var(--vscode-font-size, 13px);
    color: var(--fg);
    background: var(--bg);
    overflow: hidden;
  }
  body { display: flex; flex-direction: column; }

  /* ── Splash (shown when proxy is offline) ────────── */
  #splash {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    text-align: center;
    gap: 12px;
  }
  #splash .logo {
    width: 48px;
    height: 48px;
    margin-bottom: 8px;
    opacity: 0.6;
  }
  #splash h2 {
    font-size: 16px;
    font-weight: 600;
    color: var(--fg);
  }
  #splash p {
    font-size: 13px;
    color: var(--muted);
    line-height: 1.6;
    max-width: 280px;
  }
  #splash .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
    width: 100%;
    max-width: 220px;
  }
  #splash .actions button {
    padding: 10px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: opacity 0.15s;
  }
  #splash .actions button:hover { opacity: 0.9; }
  .btn-primary {
    background: var(--btn-bg);
    color: var(--btn-fg);
  }
  .btn-secondary {
    background: var(--input-bg);
    color: var(--fg);
    border: 1px solid var(--border) !important;
  }
  #splash .status-text {
    font-size: 11px;
    color: var(--muted);
    margin-top: 4px;
  }
  #splash .status-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 4px;
  }
  .dot-offline { background: #f48771; }
  .dot-online { background: #4ec9b0; }
  .dot-loading { background: #cca700; animation: pulse 1s infinite; }
  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }

  /* ── Main app (shown when proxy is online) ───────── */
  #app { display: none; flex: 1; flex-direction: column; overflow: hidden; }

  /* Tabs */
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    flex-shrink: 0;
  }
  .tab {
    flex: 1;
    padding: 8px 12px;
    text-align: center;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    color: var(--muted);
    border-bottom: 2px solid transparent;
    user-select: none;
    transition: color 0.15s, border-color 0.15s;
  }
  .tab:hover { color: var(--fg); }
  .tab.active { color: var(--fg); border-bottom-color: var(--accent); }

  /* Panels */
  .panel { display: none; flex-direction: column; flex: 1; overflow: hidden; }
  .panel.active { display: flex; }

  /* ── Chat Panel ─────────────────────────────────── */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .msg {
    max-width: 90%;
    padding: 8px 12px;
    border-radius: 8px;
    line-height: 1.5;
    word-wrap: break-word;
    white-space: pre-wrap;
  }
  .msg.user { align-self: flex-end; background: var(--user-bg); color: var(--user-fg); }
  .msg.assistant { align-self: flex-start; background: var(--bubble-bg); }
  .msg.error { align-self: flex-start; background: #5a1d1d; color: #f48771; }
  .input-area {
    display: flex;
    padding: 8px;
    border-top: 1px solid var(--border);
    gap: 6px;
    flex-shrink: 0;
  }
  .input-area textarea {
    flex: 1;
    background: var(--input-bg);
    color: var(--input-fg);
    border: 1px solid var(--input-border);
    border-radius: 4px;
    padding: 8px 10px;
    font-family: inherit;
    font-size: 13px;
    resize: none;
    outline: none;
    min-height: 36px;
    max-height: 120px;
    line-height: 1.4;
  }
  .input-area textarea:focus { border-color: var(--accent); }
  .send-btn {
    background: var(--btn-bg);
    color: var(--btn-fg);
    border: none;
    border-radius: 4px;
    padding: 0 14px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    height: 36px;
  }
  .send-btn:hover { opacity: 0.9; }
  .send-btn:disabled { opacity: 0.4; cursor: default; }

  /* ── Dashboard Panel ────────────────────────────── */
  #dashboardPanel { padding: 0; background: var(--bg); }

  /* When the panel is narrow (< 400px), show a compact fallback */
  #dashboardFallback {
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 24px;
    text-align: center;
    flex: 1;
    color: var(--muted);
  }
  #dashboardFallback .dash-icon {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: var(--input-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
  }
  #dashboardFallback h3 {
    font-size: 15px;
    font-weight: 600;
    color: var(--fg);
  }
  #dashboardFallback .dash-links {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 240px;
  }
  #dashboardFallback .dash-links button {
    padding: 10px 16px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--fg);
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: border-color 0.15s;
  }
  #dashboardFallback .dash-links button:hover {
    border-color: var(--accent);
  }
  #dashboardFallback .dash-links button .dash-link-icon {
    opacity: 0.6;
  }
  #dashboardFrame {
    width: 100%;
    height: 100%;
    border: none;
    flex: 1;
    background: #fff;
  }

  /* Status banner inside dashboard */
  #dashStatusBar {
    display: none;
    flex-shrink: 0;
    padding: 6px 12px;
    font-size: 11px;
    color: var(--muted);
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    align-items: center;
    gap: 6px;
  }
  #dashStatusBar .dash-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #4ec9b0;
  }
  #dashStatusBar .dash-open-btn {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 3px;
  }
  #dashStatusBar .dash-open-btn:hover {
    background: var(--input-bg);
  }

  /* Connection status bar */
  #connectionBar {
    display: none;
    flex-shrink: 0;
    padding: 4px 12px;
    font-size: 10px;
    background: var(--input-bg);
    border-bottom: 1px solid var(--border);
    color: var(--muted);
    align-items: center;
    gap: 6px;
  }
</style>
</head>
<body>

  <!-- Splash screen (proxy offline) -->
  <div id="splash">
    <svg class="logo" viewBox="0 0 24 24" fill="none">
      <path d="M12 2 C7 2 4 5.5 4 9 C4 11.5 5 13 6.5 14 L6.5 18 C6.5 18.5 7 19 7.5 19 L8 19 L8 16 C8 15.5 7.5 15 7 15 L7 14.5 C5.5 13.8 4.8 12 4.8 10 C4.8 6 7.5 3 12 3 C16.5 3 19.2 6 19.2 10 C19.2 12 18.5 13.8 17 14.5 L17 15 C16.5 15 16 15.5 16 16 L16 19 L16.5 19 C17 19 17.5 18.5 17.5 18 L17.5 14 C19 13 20 11.5 20 9 C20 5.5 17 2 12 2 Z" fill="currentColor" opacity="0.4"/>
    </svg>
    <h2>Spectre Proxy</h2>
    <p id="splashMessage">Checking proxy status...</p>
    <div class="actions">
      <button class="btn-primary" id="startBtn" onclick="startProxy()" style="display:none">Start Proxy</button>
      <button class="btn-secondary" id="dashboardBtn" onclick="openDashboard()" style="display:none">Open Dashboard</button>
    </div>
    <div class="status-text" id="statusText"></div>
  </div>

  <!-- Main app (proxy online) -->
  <div id="app">
    <div id="connectionBar">
      <span class="status-dot dot-online"></span>
      <span id="proxyStatusText">Proxy running on port 8082</span>
    </div>
    <div class="tabs">
      <div class="tab active" data-tab="chat" onclick="switchTab('chat')">Chat</div>
      <div class="tab" data-tab="dashboard" onclick="switchTab('dashboard')">Dashboard</div>
    </div>
    <div id="chatPanel" class="panel active">
      <div class="messages" id="messages"></div>
      <div class="input-area">
        <textarea id="input" placeholder="Message Spectre..." rows="1" onkeydown="handleKey(event)"></textarea>
        <button class="send-btn" id="sendBtn" onclick="sendMessage()">Send</button>
      </div>
    </div>
    <div id="dashboardPanel" class="panel">
      <div id="dashStatusBar">
        <span class="dash-dot"></span>
        <span>Dashboard</span>
        <button class="dash-open-btn" onclick="openDashboard()">Open in Browser →</button>
      </div>
      <div id="dashboardFallback">
        <div class="dash-icon">📊</div>
        <h3>Spectre Dashboard</h3>
        <p>Panel is too narrow for the full dashboard. Open it in your browser or use these quick links:</p>
        <div class="dash-links">
          <button onclick="navigate('/')">📊 Dashboard Home</button>
          <button onclick="navigate('/kanban')">✓ Task Board</button>
          <button onclick="navigate('/memory')">🧠 Memory Vault</button>
          <button onclick="navigate('/tools')">🔧 Configuration</button>
        </div>
      </div>
      <iframe id="dashboardFrame" src="" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
    </div>
  </div>

<script>
  const vscode = acquireVsCodeApi();
  const splash = document.getElementById("splash");
  const app = document.getElementById("app");
  const splashMsg = document.getElementById("splashMessage");
  const startBtn = document.getElementById("startBtn");
  const dashboardBtn = document.getElementById("dashboardBtn");
  const statusText = document.getElementById("statusText");
  const messagesDiv = document.getElementById("messages");
  const inputEl = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");
  const dashFrame = document.getElementById("dashboardFrame");
  const dashFallback = document.getElementById("dashboardFallback");
  const connectionBar = document.getElementById("connectionBar");
  const proxyStatusText = document.getElementById("proxyStatusText");
  const dashStatusBar = document.getElementById("dashStatusBar");

  let config = {};
  let panelWidth = 0;

  // ── Observe panel resize for responsive dashboard ──
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      panelWidth = entry.contentRect.width;
      updateDashboardView();
    }
  });
  resizeObserver.observe(document.body);

  function updateDashboardView() {
    const dashPanel = document.getElementById("dashboardPanel");
    const isDashActive = dashPanel.classList.contains("active");
    if (!isDashActive) return;

    // Show iframe if panel is wide enough, otherwise show fallback links
    if (panelWidth >= 420 && config.dashboardUrl) {
      dashFrame.style.display = "flex";
      dashFallback.style.display = "none";
      // Load iframe lazily only when needed
      if (!dashFrame.src) {
        dashFrame.src = config.dashboardUrl;
      }
    } else {
      dashFrame.style.display = "none";
      dashFallback.style.display = "flex";
    }
  }

  // ── Check status on load ────────────────────────────
  checkStatus();
  vscode.postMessage({ type: "getConfig" });

  function checkStatus() {
    splashMsg.textContent = "Checking proxy status...";
    statusText.innerHTML = '<span class="status-dot dot-loading"></span> Checking...';
    vscode.postMessage({ type: "checkStatus" });
  }

  // ── Handle messages from extension host ──────────────
  window.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
      case "statusResult":
        if (msg.ok) {
          splash.style.display = "none";
          app.style.display = "flex";
          connectionBar.style.display = "flex";
        } else {
          splash.style.display = "flex";
          app.style.display = "none";
          splashMsg.textContent = "Proxy is offline";
          statusText.innerHTML = '<span class="status-dot dot-offline"></span> Not running';
          startBtn.style.display = "block";
          dashboardBtn.style.display = "block";
        }
        break;
      case "configResult":
        config = msg.config || {};
        if (config.proxyPort) {
          proxyStatusText.textContent = "Proxy running on port " + config.proxyPort;
        }
        // Update iframe src if we have a new dashboard URL
        if (config.dashboardUrl && panelWidth >= 420) {
          dashFrame.src = config.dashboardUrl;
        }
        break;
      case "chatDelta":
        if (!currentMsg) {
          currentMsg = document.createElement("div");
          currentMsg.className = "msg assistant";
          messagesDiv.appendChild(currentMsg);
        }
        currentMsg.textContent = msg.content;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        break;
      case "chatDone":
        messages.push({ role: "assistant", content: msg.content });
        currentMsg = null;
        sendBtn.disabled = false;
        break;
      case "chatError":
        addMessage("error", "Error: " + msg.error);
        currentMsg = null;
        sendBtn.disabled = false;
        break;
    }
  });

  // ── Actions ───────────────────────────────────────────
  function startProxy() {
    startBtn.disabled = true;
    startBtn.textContent = "Starting...";
    splashMsg.textContent = "Starting proxy...";
    statusText.innerHTML = '<span class="status-dot dot-loading"></span> Starting...';
    vscode.postMessage({ type: "startProxy" });
  }

  function openDashboard() {
    vscode.postMessage({ type: "openDashboard" });
  }

  function navigate(path) {
    vscode.postMessage({ type: "dashNavigate", path });
  }

  // ── Tab switching ────────────────────────────────────
  function switchTab(name) {
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === name + "Panel"));

    // Update dashboard view when switching to dashboard tab
    if (name === "dashboard") {
      updateDashboardView();
    }
  }

  // ── Chat ──────────────────────────────────────────────
  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function addMessage(role, text) {
    const div = document.createElement("div");
    div.className = "msg " + role;
    div.textContent = text;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  let messages = [];
  let currentMsg = null;

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;
    addMessage("user", text);
    messages.push({ role: "user", content: text });
    inputEl.value = "";
    sendBtn.disabled = true;
    currentMsg = null;
    vscode.postMessage({ type: "chat", messages, model: "" });
  }
</script>
</body>
</html>`;
  }
}
