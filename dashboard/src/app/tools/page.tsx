"use client";

import { useState, useEffect, useCallback } from "react";
import SpectreConfig from "@/components/SpectreConfig";
import Modal from "@/components/Modal";
import { Clock, Puzzle, Workflow, Zap, Sparkles, Cog, Power, Bot, FileText, MessageSquare, Brain, Layout, Filter, BarChart2, Share2, Minimize2 } from "lucide-react";

// ─── Curated Plugins ──────────────────────────────────────────────────

const CURATED_PLUGINS = [
  { name: "Claude Code Plugins", description: "Official Anthropic plugin system for custom tools and MCP servers", url: "https://github.com/anthropics/claude-code/tree/main/plugins", category: "official", keyword: "claude-code-plugins" },
  { name: "Archify", description: "Architectural decision records and project scaffolding", url: "https://tt-a1i.github.io/archify/#quickstart", category: "architecture", keyword: "archify" },
  { name: "CC Skills — Go", description: "Go development skills — testing, linting, project setup", url: "https://github.com/samber/cc-skills-golang", category: "skills", keyword: "go-skills" },
  { name: "Flutter Claude Skills", description: "Flutter and Dart development skills for Claude Code", url: "https://github.com/Harishwarrior/flutter-claude-skills", category: "skills", keyword: "flutter-skills" },
];

// ─── Section header component ────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-1 h-6 rounded-full bg-primary" />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-base-content/70 shrink-0">{icon}</span>
        <h2 className="font-bold text-lg tracking-tight">{title}</h2>
      </div>
      {subtitle && <span className="text-xs text-base-content/70 hidden sm:block">{subtitle}</span>}
    </div>
  );
}

// ─── Workspace ────────────────────────────────────────────────────────

function WorkspaceSection() {
  const [workspace, setWorkspace] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/spectre-proxy/admin/config").then(r => r.json()).then(d => { if (d.config?.DEFAULT_WORKSPACE) setWorkspace(d.config.DEFAULT_WORKSPACE); }).catch(() => {});
  }, []);

  const save = async () => {
    try {
      await fetch("/api/spectre-proxy/admin/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ DEFAULT_WORKSPACE: workspace }) });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  return (
    <div className="rounded-xl bg-base-200 border border-base-content/10 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <Workflow size={18} className="text-primary" />
        <h3 className="font-bold text-sm">Default Workspace</h3>
      </div>
      <p className="text-sm text-base-content/60 mb-3">Used by the CLI when no <code className="bg-base-300 px-1.5 py-0.5 rounded text-xs font-mono">--dir</code> flag is given.</p>
      <div className="flex gap-2">
        <input type="text" className="input input-bordered flex-1 bg-base-300 border-base-content/20" placeholder="/path/to/workspace" value={workspace} onChange={e => setWorkspace(e.target.value)} />
        <button className={`btn ${saved ? "btn-success" : "btn-primary"} btn-sm`} onClick={save}>
          {saved ? "Saved!" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ─── Plugin Marketplace ──────────────────────────────────────────────

function PluginsSection() {
  const [query, setQuery] = useState("");
  const filtered = CURATED_PLUGINS.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.description.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="rounded-xl bg-base-200 border border-base-content/10 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <Puzzle size={18} className="text-primary" />
        <h3 className="font-bold text-sm">Plugins</h3>
      </div>
      <label className="input input-bordered flex items-center gap-2 mb-3 bg-base-300 border-base-content/20">
        <span className="material-symbols-outlined text-base-content/60 text-sm">search</span>
        <input type="text" className="grow" placeholder="Search plugins..." value={query} onChange={e => setQuery(e.target.value)} />
      </label>
      <div className="flex flex-col gap-2">
        {filtered.map(p => (
          <div key={p.keyword} className="rounded-lg bg-base-300 border border-base-content/10 px-3 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-base-content/90">{p.name}</div>
              <div className="text-xs text-base-content/70 mt-0.5">{p.description}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="badge badge-ghost badge-sm">{p.category}</div>
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-xs btn-square">
                <span className="material-symbols-outlined text-sm">open_in_new</span>
              </a>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center py-6 text-sm text-base-content/60">No plugins match.</p>}
      </div>
    </div>
  );
}

// ─── Cron Jobs ────────────────────────────────────────────────────────

function CronSection() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [interval, setIntervalVal] = useState("1d");

  const load = () => fetch("/api/spectre-proxy/cron").then(r => r.json()).then(d => setJobs(d.jobs || [])).catch(() => {});
  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, []);

  const addCron = async () => {
    if (!name.trim() || !prompt.trim()) return;
    await fetch("/api/spectre-proxy/cron", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", name: name.trim(), prompt: prompt.trim(), interval }) });
    setName(""); setPrompt(""); setShowAdd(false); load();
  };
  const toggleCron = async (id: string) => { await fetch("/api/spectre-proxy/cron", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", id }) }); load(); };
  const removeCron = async (id: string) => { await fetch("/api/spectre-proxy/cron", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", id }) }); load(); };
  const addDreamCron = async () => {
    await fetch("/api/spectre-proxy/cron", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", name: "[Dream] Auto vault dreaming", prompt: "__dream__", interval: "6h" }) });
    fetch("/api/spectre-proxy/dream").catch(() => {}); load();
  };

  return (
    <div className="rounded-xl bg-base-200 border border-base-content/10 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Clock size={18} className="text-primary" />
          <h3 className="font-bold text-sm">Scheduled Tasks</h3>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-xs" onClick={addDreamCron}><Sparkles size={14} /> Dream</button>
          <button className="btn btn-primary btn-xs" onClick={() => setShowAdd(!showAdd)}>{showAdd ? "Cancel" : "+ Add"}</button>
        </div>
      </div>

      {showAdd && (
        <div className="flex flex-col gap-2.5 p-4 rounded-lg bg-base-300 border border-base-content/10 mb-4">
          <input type="text" className="input input-bordered input-sm bg-base-200 border-base-content/20" placeholder="Job name" value={name} onChange={e => setName(e.target.value)} />
          <textarea className="textarea textarea-bordered textarea-sm bg-base-200 border-base-content/20" placeholder="Prompt to run on schedule" value={prompt} onChange={e => setPrompt(e.target.value)} rows={2} />
          <div className="flex gap-2 items-center">
            <select className="select select-bordered select-sm bg-base-200 border-base-content/20 flex-1" value={interval} onChange={e => setIntervalVal(e.target.value)}>
              <option value="15m">Every 15 min</option>
              <option value="1h">Every hour</option>
              <option value="6h">Every 6 hours</option>
              <option value="1d">Every day</option>
              <option value="7d">Every week</option>
            </select>
            <button className="btn btn-primary btn-xs" onClick={addCron}>Schedule</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
        {jobs.map((j: any) => (
          <div key={j.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-base-300 border border-base-content/5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className={`font-medium ${j.enabled ? "text-base-content/90" : "text-base-content/60"}`}>{j.name}</span>
                <div className="badge badge-ghost badge-xs">every {j.interval}</div>
                {j.name.startsWith("[Dream]") && <Sparkles size={12} className="text-secondary" />}
              </div>
              {j.last_run && <div className="text-xs text-base-content/70 mt-0.5">Last: {new Date(j.last_run).toLocaleString()}</div>}
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-3">
              <button className="btn btn-ghost btn-xs btn-square" onClick={() => toggleCron(j.id)}>
                <span className={`material-symbols-outlined text-sm ${j.enabled ? "text-primary" : ""}`}>{j.enabled ? "pause" : "play_arrow"}</span>
              </button>
              <button className="btn btn-ghost btn-xs btn-square" onClick={() => removeCron(j.id)}>
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            </div>
          </div>
        ))}
        {jobs.length === 0 && <p className="text-center py-6 text-sm text-base-content/60">No scheduled tasks.</p>}
      </div>
    </div>
  );
}

// ─── MCP Servers ─────────────────────────────────────────────────────

function MCPSection() {
  const [mcps, setMcps] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const load = () => { const local: any[] = JSON.parse(localStorage.getItem("spectre-mcps") || "[]"); setMcps(local); };
  useEffect(() => { load(); }, []);

  const save = (next: any[]) => { setMcps(next); localStorage.setItem("spectre-mcps", JSON.stringify(next)); };
  const add = () => { if (!name.trim() || !url.trim()) return; save([...mcps, { id: crypto.randomUUID(), name: name.trim(), url: url.trim(), enabled: true }]); setName(""); setUrl(""); setOpen(false); setEditId(null); };
  const update = () => { if (!name.trim() || !url.trim() || !editId) return; save(mcps.map(m => m.id === editId ? { ...m, name: name.trim(), url: url.trim() } : m)); setName(""); setUrl(""); setOpen(false); setEditId(null); };
  const toggle = (id: string) => save(mcps.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
  const remove = (id: string) => save(mcps.filter(m => m.id !== id));
  const startEdit = (m: any) => { setName(m.name); setUrl(m.url); setEditId(m.id); setOpen(true); };

  return (
    <div className="rounded-xl bg-base-200 border border-base-content/10 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Zap size={18} className="text-primary" />
          <h3 className="font-bold text-sm">MCP Servers</h3>
        </div>
        <button className="btn btn-primary btn-xs" onClick={() => { setName(""); setUrl(""); setEditId(null); setOpen(true); }}>+ Add</button>
      </div>

      {open && (
        <div className="flex flex-col gap-2.5 p-4 rounded-lg bg-base-300 border border-base-content/10 mb-4">
          <input type="text" className="input input-bordered input-sm bg-base-200 border-base-content/20" placeholder="Server name" value={name} onChange={e => setName(e.target.value)} />
          <input type="text" className="input input-bordered input-sm bg-base-200 border-base-content/20" placeholder="Command or URL" value={url} onChange={e => setUrl(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn btn-primary btn-xs" onClick={editId ? update : add}>{editId ? "Update" : "Connect"}</button>
            <button className="btn btn-ghost btn-xs" onClick={() => { setOpen(false); setEditId(null); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
        {mcps.map(m => (
          <div key={m.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-base-300 border border-base-content/5">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-base-content/90">{m.name}</div>
              <div className="text-xs text-base-content/70 mt-0.5 truncate">{m.url}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <button className="btn btn-ghost btn-xs btn-square" onClick={() => startEdit(m)}>
                <span className="material-symbols-outlined text-sm">edit</span>
              </button>
              <input type="checkbox" className="toggle toggle-xs" checked={m.enabled} onChange={() => toggle(m.id)} />
              <button className="btn btn-ghost btn-xs btn-square" onClick={() => remove(m.id)}>
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            </div>
          </div>
        ))}
        {mcps.length === 0 && <p className="text-center py-6 text-sm text-base-content/60">No MCP servers.</p>}
      </div>
    </div>
  );
}

// ─── Sub-Agents ──────────────────────────────────────────────────────

function SubAgentsSection() {
  const [agents, setAgents] = useState<any[]>([]);
  const [fsAgents, setFsAgents] = useState<any[]>([]);
  const [editModal, setEditModal] = useState<{ agent?: any; file?: string } | null>(null);
  const [viewAgent, setViewAgent] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [instructions, setInstructions] = useState("");

  const load = () => {
    const local = JSON.parse(localStorage.getItem("spectre-subagents") || "[]");
    setAgents(local);
    fetch("/api/spectre-proxy/agents").then(r => r.json()).then(d => setFsAgents(d.agents || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const save = (next: any[]) => { setAgents(next); localStorage.setItem("spectre-subagents", JSON.stringify(next)); };
  const add = () => {
    if (!name.trim()) return;
    save([...agents, { id: crypto.randomUUID(), name: name.trim(), model: "auto", instructions: instructions.trim() }]);
    closeEdit();
  };
  const update = () => {
    if (!name.trim() || !editModal?.agent?.id) return;
    save(agents.map(a => a.id === editModal.agent.id ? { ...a, name: name.trim(), instructions: instructions.trim() } : a));
    closeEdit();
  };
  const remove = (id: string) => save(agents.filter(a => a.id !== id));
  const updateFS = async () => {
    if (!name.trim() || !editModal?.file) return;
    await fetch("/api/spectre-proxy/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", file: editModal.file, name: name.trim(), keywords: keywords.split(",").map((k: string) => k.trim()).filter(Boolean), instructions: instructions.trim() }) });
    closeEdit(); load();
  };
  const deleteFS = async (file: string) => { await fetch("/api/spectre-proxy/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", file }) }); load(); };

  const openCreate = () => { setName(""); setKeywords(""); setInstructions(""); setEditModal({}); };
  const openEdit = (a: any) => { setName(a.name); setKeywords(""); setInstructions(a.instructions); setEditModal({ agent: a }); };
  const openEditFS = (a: any) => { setName(a.name); setKeywords((a.keywords || []).join(", ")); setInstructions(a.instructions); setEditModal({ file: a.file }); };
  const closeEdit = () => { setEditModal(null); setName(""); setKeywords(""); setInstructions(""); };

  const isCreating = editModal && !editModal.agent && !editModal.file;
  const isEditing = editModal && (editModal.agent || editModal.file);
  const modalTitle = isCreating ? "Create Agent" : editModal?.file ? "Edit File Agent" : "Edit Agent";

  return (
    <div className="rounded-xl bg-base-200 border border-base-content/10 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Bot size={18} className="text-primary" />
          <h3 className="font-bold text-sm">Sub-Agents</h3>
          <span className="badge badge-sm text-xs bg-base-300 text-base-content/60">.md files in ~/.spectre/agents/</span>
        </div>
        <button className="btn btn-primary btn-xs" onClick={openCreate}>
          <span className="material-symbols-outlined text-sm">add</span> Create
        </button>
      </div>

      {/* Edit / Create Modal */}
      <Modal open={!!editModal} onClose={closeEdit} title={modalTitle}>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-base-content/60 mb-1 block">Agent name</label>
            <input type="text" className="input input-bordered w-full bg-base-300 border-base-content/20" placeholder="e.g. Go Specialist" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          {editModal?.file && (
            <div>
              <label className="text-xs font-medium text-base-content/60 mb-1 block">Keywords (comma separated)</label>
              <input type="text" className="input input-bordered w-full bg-base-300 border-base-content/20" placeholder="e.g. go, golang, testing" value={keywords} onChange={e => setKeywords(e.target.value)} />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-base-content/60 mb-1 block">System instructions</label>
            <textarea className="textarea textarea-bordered w-full bg-base-300 border-base-content/20" placeholder="You are an expert Go developer..." value={instructions} onChange={e => setInstructions(e.target.value)} rows={5} />
          </div>
          <div className="flex gap-2 pt-2">
            <button className="btn btn-primary btn-sm flex-1" onClick={editModal?.file ? updateFS : (editModal?.agent ? update : add)}>
              {editModal?.file ? "Update File" : editModal?.agent ? "Update" : "Create"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={closeEdit}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal open={!!viewAgent} onClose={() => setViewAgent(null)} title={viewAgent?.name || ""}>
        {viewAgent?.keywords?.length > 0 && (
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {viewAgent.keywords.map((kw: string) => <div key={kw} className="badge badge-primary badge-sm">{kw}</div>)}
          </div>
        )}
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-base-content/70 bg-base-300 rounded-xl p-4">
          {viewAgent?.instructions || "No instructions set."}
        </div>
      </Modal>

      {/* Pre-defined agents (from .md files) */}
      {fsAgents.length > 0 && (
        <>
          <div className="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-2">Pre-defined</div>
          <div className="flex flex-col gap-1.5 mb-4">
            {fsAgents.map((a: any) => (
              <div key={a.file} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-base-300 border border-base-content/5 border-l-primary/40 border-l-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-base-content/90">{a.name}</div>
                  {a.keywords?.length > 0 && <div className="flex gap-1 mt-1 flex-wrap">{a.keywords.slice(0, 4).map((kw: string) => <div key={kw} className="badge badge-ghost badge-xs">{kw}</div>)}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <button className="btn btn-ghost btn-xs btn-square" onClick={() => setViewAgent(a)}><span className="material-symbols-outlined text-sm">visibility</span></button>
                  <button className="btn btn-ghost btn-xs btn-square" onClick={() => openEditFS(a)}><span className="material-symbols-outlined text-sm">edit</span></button>
                  <button className="btn btn-ghost btn-xs btn-square" onClick={() => deleteFS(a.file)}><span className="material-symbols-outlined text-sm">delete</span></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Custom agents (localStorage) */}
      <div className="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-2">Custom</div>
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
        {agents.map(a => (
          <div key={a.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-base-300 border border-base-content/5">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-base-content/90">{a.name}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-3">
              <button className="btn btn-ghost btn-xs btn-square" onClick={() => openEdit(a)}><span className="material-symbols-outlined text-sm">edit</span></button>
              <button className="btn btn-ghost btn-xs btn-square" onClick={() => remove(a.id)}><span className="material-symbols-outlined text-sm">delete</span></button>
            </div>
          </div>
        ))}
        {agents.length === 0 && <p className="text-center py-4 text-sm text-base-content/60">No custom agents. Create one or define .md files.</p>}
      </div>
    </div>
  );
}

// ─── Token Saver Settings ─────────────────────────────────────────────

function TokenSaverSection() {
  const [settings, setSettings] = useState({
    CLI_BACKEND: "claude",
    CMD_COMPRESS_ENABLED: "true",
    RESPONSE_COMPRESS_LEVEL: "full",
    BEHAVIOR_ENABLED: "true",
  });
  const [saved, setSaved] = useState(false);
  const [saverReport, setSaverReport] = useState("");

  useEffect(() => {
    fetch("/api/spectre-proxy/admin/config").then(r => r.json()).then(d => {
      if (d.config) {
        setSettings(prev => ({
          ...prev,
          CLI_BACKEND: d.config.CLI_BACKEND || prev.CLI_BACKEND,
          CMD_COMPRESS_ENABLED: d.config.CMD_COMPRESS_ENABLED || prev.CMD_COMPRESS_ENABLED,
          RESPONSE_COMPRESS_LEVEL: d.config.RESPONSE_COMPRESS_LEVEL || prev.RESPONSE_COMPRESS_LEVEL,
          BEHAVIOR_ENABLED: d.config.BEHAVIOR_ENABLED || prev.BEHAVIOR_ENABLED,
        }));
      }
    }).catch(() => {});
    // Fetch saver report via CLI
    fetch("/api/spectre-proxy/status").then(() => {
      // The saver report is available via the token_savings MCP tool
    }).catch(() => {});
  }, []);

  const save = async (updates: Record<string, string>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    try {
      await fetch("/api/spectre-proxy/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  return (
    <div className="rounded-xl bg-base-200 border border-base-content/10 p-5 shadow-sm">
      <div className="flex flex-col gap-4">

        {/* Default CLI */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Brain size={16} className="text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium">Default CLI Backend</div>
              <div className="text-xs text-base-content/60">Which coding agent to launch with <code>spectre</code></div>
            </div>
          </div>
          <select
            value={settings.CLI_BACKEND}
            onChange={e => save({ CLI_BACKEND: e.target.value })}
            className="select select-sm max-w-32 bg-base-300 border-base-content/20"
          >
            <option value="claude">Claude Code</option>
            <option value="codex">Codex</option>
            <option value="gemini">Gemini</option>
          </select>
        </div>

        <div className="divider my-1" />

        {/* Command compression */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <FileText size={16} className="text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium">Command Compression</div>
              <div className="text-xs text-base-content/60">Compress command output (git, ls, cargo, etc.) before sending to LLM</div>
            </div>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={settings.CMD_COMPRESS_ENABLED === "true"}
            onChange={e => save({ CMD_COMPRESS_ENABLED: e.target.checked ? "true" : "false" })}
          />
        </div>

        {/* Response compression */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <MessageSquare size={16} className="text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium">Response Compression</div>
              <div className="text-xs text-base-content/60">Strip filler, pleasantries, and hedging from agent responses</div>
            </div>
          </div>
          <select
            value={settings.RESPONSE_COMPRESS_LEVEL}
            onChange={e => save({ RESPONSE_COMPRESS_LEVEL: e.target.value })}
            className="select select-sm max-w-28 bg-base-300 border-base-content/20"
          >
            <option value="off">Off</option>
            <option value="lite">Lite</option>
            <option value="full">Full</option>
            <option value="ultra">Ultra</option>
          </select>
        </div>

        {/* Behavioral guidelines */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Brain size={16} className="text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium">Behavioral Guidelines</div>
              <div className="text-xs text-base-content/60">Inject behavioral guidelines (think before coding, simplicity first, surgical changes)</div>
            </div>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={settings.BEHAVIOR_ENABLED === "true"}
            onChange={e => save({ BEHAVIOR_ENABLED: e.target.checked ? "true" : "false" })}
          />
        </div>

        {saved && (
          <div className="text-xs text-success font-medium text-center">Settings saved</div>
        )}
      </div>
    </div>
  );
}

// ─── Built-in Tools ────────────────────────────────────────────

interface BuiltInTool {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  enabled: boolean;
  level?: string;
  configurable?: boolean;
  levels?: { value: string; label: string; desc: string }[];
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  brain: <Brain size={16} />,
  "minimize-2": <Minimize2 size={16} />,
  layout: <Layout size={16} />,
  filter: <Filter size={16} />,
  "bar-chart-2": <BarChart2 size={16} />,
  "share-2": <Share2 size={16} />,
};

function BuiltInToolsSection() {
  const [tools, setTools] = useState<BuiltInTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/spectre-proxy/tools")
      .then((r) => r.json())
      .then((d) => {
        setTools(d.tools || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleTool = async (id: string, enabled: boolean) => {
    setSaving(id);
    try {
      await fetch("/api/spectre-proxy/tools", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      setTools((prev) =>
        prev.map((t) => (t.id === id ? { ...t, enabled } : t))
      );
    } catch {}
    setTimeout(() => setSaving(null), 500);
  };

  const setLevel = async (id: string, level: string) => {
    setSaving(id);
    try {
      await fetch("/api/spectre-proxy/tools", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, level }),
      });
      setTools((prev) =>
        prev.map((t) => (t.id === id ? { ...t, level } : t))
      );
    } catch {}
    setTimeout(() => setSaving(null), 500);
  };

  const resetAll = async () => {
    try {
      await fetch("/api/spectre-proxy/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      // Reload
      const r = await fetch("/api/spectre-proxy/tools");
      const d = await r.json();
      setTools(d.tools || []);
    } catch {}
  };

  if (loading) {
    return (
      <div className="rounded-xl bg-base-200 border border-base-content/10 p-5 shadow-sm">
        <p className="text-sm text-base-content/60 text-center py-4">Loading tools...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-base-200 border border-base-content/10 p-5 shadow-sm">
      <div className="flex flex-col gap-3">
        {tools.map((tool) => (
          <div
            key={tool.id}
            className="rounded-lg bg-base-300 border border-base-content/10 px-4 py-3 flex items-center gap-4"
          >
            {/* Icon */}
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${tool.color}22` }}
            >
              <span style={{ color: tool.color }}>
                {TOOL_ICONS[tool.icon] || <Cog size={16} />}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-base-content/90">
                  {tool.name}
                </span>
                {saving === tool.id && (
                  <span className="text-xs text-primary animate-pulse">
                    saving...
                  </span>
                )}
              </div>
              <p className="text-xs text-base-content/60 mt-0.5 truncate">
                {tool.description}
              </p>
            </div>

            {/* Level selector (for configurable tools) */}
            {tool.configurable && tool.levels && tool.enabled && (
              <select
                value={tool.level || "full"}
                onChange={(e) => setLevel(tool.id, e.target.value)}
                className="select select-xs max-w-24 bg-base-200 border-base-content/20"
              >
                {tool.levels.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            )}

            {/* Toggle */}
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary"
              checked={tool.enabled}
              onChange={(e) => toggleTool(tool.id, e.target.checked)}
            />
          </div>
        ))}

        {/* Reset button */}
        <div className="flex justify-end mt-2">
          <button className="btn btn-ghost btn-xs text-base-content/60" onClick={resetAll}>
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────

export default function ToolsPage() {
  return (
    <div className="flex flex-col gap-8">

      {/* ─── Configuration ────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<Cog size={20} />} title="Configuration" subtitle="API keys, model routing, and proxy settings" />
        <SpectreConfig />
      </section>

      {/* ─── Token Saver ──────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<Zap size={20} />} title="Token Saver" subtitle="Compression layers to reduce token usage (all enabled by default)" />
        <TokenSaverSection />
      </section>

      {/* ─── Built-in Tools ──────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<Cog size={20} />} title="Built-in Tools" subtitle="Auto-run tools for prompt injection, output compression, and more" />
        <BuiltInToolsSection />
      </section>

      {/* ─── Automation ───────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<Power size={20} />} title="Automation" subtitle="Cron jobs and MCP server connections" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CronSection />
          <MCPSection />
        </div>
      </section>

      {/* ─── Agents ──────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<Bot size={20} />} title="Agents" subtitle="Sub-agent .md files and custom agent definitions" />
        <SubAgentsSection />
      </section>

      {/* ─── Extras ────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={<Puzzle size={20} />} title="Extras" subtitle="Plugin marketplace and workspace settings" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PluginsSection />
          <WorkspaceSection />
        </div>
      </section>
    </div>
  );
}
