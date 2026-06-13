"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity, Brain, ListChecks, Clock, ArrowRight, Wrench,
  Cpu, CheckCircle2, Sparkles
} from "lucide-react";

interface AgentStatus { status: string; model: string | null; provider: string | null; latency: number | null; }
interface TaskStats { total: number; pending: number; running: number; completed: number; failed: number; }
interface ActivityEntry { ts: number; type: string; agent: string; text: string; }

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-base-200 border border-base-content/10 p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <span className={`${color} shrink-0`}>{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-base-content/70">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [agent, setAgent] = useState<AgentStatus>({ status: "loading", model: null, provider: null, latency: null });
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [notesCount, setNotesCount] = useState(0);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/spectre-proxy/status").then(r => r.json()).catch(() => ({ status: "error" })),
      fetch("/api/spectre-proxy/admin/config").then(r => r.json()).catch(() => ({ config: {} })),
      fetch("/api/spectre-proxy/tasks").then(r => r.json()).catch(() => ({ stats: null })),
      fetch("/api/vault/notes").then(r => r.json()).catch(() => ({ notes: [] })),
      fetch("/api/spectre-proxy/activity", { cache: "no-store" }).then(r => r.json()).catch(() => ({ entries: [] })),
    ]).then(([status, config, tasks, notes, act]) => {
      setAgent({
        status: status.status || "error",
        model: config.config?.MODEL || null,
        provider: config.config?.MODEL?.split("/")[0] || null,
        latency: status.latency || null,
      });
      if (tasks.stats) setStats(tasks.stats);
      setNotesCount(notes.notes?.length || 0);
      setActivity(act.entries?.slice(0, 5) || []);
    });
  }, []);

  const healthy = agent.status === "ok" || agent.status === "healthy";

  return (
    <div className="flex flex-col gap-6">

      {/* Agent Status Banner */}
      <div className={`rounded-xl border p-5 shadow-sm flex items-center justify-between flex-wrap gap-4 ${
        healthy ? "bg-base-200 border-base-content/10" : "bg-error/10 border-error/30"
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${healthy ? "bg-primary/15" : "bg-error/20"}`}>
            <Cpu size={24} className={healthy ? "text-primary" : "text-error"} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${healthy ? "bg-success" : "bg-error"}`} />
              <span className="font-bold text-lg">{healthy ? "Agent Online" : "Agent Offline"}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-base-content/60 flex-wrap">
              {agent.model && <span className="font-mono text-xs">{agent.model}</span>}
              {agent.provider && <span className="badge badge-ghost badge-xs">{agent.provider}</span>}
              {agent.latency !== null && <span className="text-xs">{agent.latency}ms latency</span>}
            </div>
          </div>
        </div>
        <Link href="/tools" className="btn btn-primary btn-sm gap-2">
          <Wrench size={14} /> Configure
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Running" value={stats?.running ?? "—"} color="text-info" icon={<Activity size={16} />} />
        <StatCard label="Completed" value={stats?.completed ?? "—"} color="text-success" icon={<CheckCircle2 size={16} />} />
        <StatCard label="Failed" value={stats?.failed ?? "—"} color="text-error" icon={<Activity size={16} />} />
        <StatCard label="Total Tasks" value={stats?.total ?? 0} color="text-base-content" icon={<ListChecks size={16} />} />
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/kanban" className="rounded-xl bg-base-200 border border-base-content/10 p-5 hover:border-primary/30 transition-all shadow-sm group">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <ListChecks size={20} className="text-primary" />
            </div>
            <div>
              <div className="font-bold text-sm">Tasks</div>
              <div className="text-xs text-base-content/70">Full task board & kanban</div>
            </div>
          </div>
          <div className="text-xs text-base-content/60 flex items-center gap-1 group-hover:text-primary transition-colors">
            Open tasks <ArrowRight size={12} />
          </div>
        </Link>

        <Link href="/memory" className="rounded-xl bg-base-200 border border-base-content/10 p-5 hover:border-primary/30 transition-all shadow-sm group">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Brain size={20} className="text-primary" />
            </div>
            <div>
              <div className="font-bold text-sm">Memory</div>
              <div className="text-xs text-base-content/70">{notesCount} notes in vault</div>
            </div>
          </div>
          <div className="text-xs text-base-content/60 flex items-center gap-1 group-hover:text-primary transition-colors">
            Explore graph <ArrowRight size={12} />
          </div>
        </Link>

        <Link href="/tools" className="rounded-xl bg-base-200 border border-base-content/10 p-5 hover:border-primary/30 transition-all shadow-sm group">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Wrench size={20} className="text-primary" />
            </div>
            <div>
              <div className="font-bold text-sm">Tools</div>
              <div className="text-xs text-base-content/70">Config, plugins, cron</div>
            </div>
          </div>
          <div className="text-xs text-base-content/60 flex items-center gap-1 group-hover:text-primary transition-colors">
            Manage tools <ArrowRight size={12} />
          </div>
        </Link>
      </div>

      {/* Activity */}
      {activity.length > 0 && (
        <div className="rounded-xl bg-base-200 border border-base-content/10 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 rounded-full bg-primary" />
            <div className="flex items-center gap-2 flex-1">
              <Clock size={16} className="text-base-content/70" />
              <h2 className="font-bold text-sm tracking-tight">Recent Activity</h2>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
            {activity.map((e, i) => {
              const isErr = e.text.toLowerCase().includes("error") || e.text.toLowerCase().includes("fail");
              return (
                <div key={`${e.ts}-${i}`} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-base-300 border border-base-content/5">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isErr ? "bg-error" : "bg-primary"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`font-bold uppercase tracking-wider ${isErr ? "text-error" : "text-primary"}`}>{e.type}</span>
                      <span className="text-base-content/70">·</span>
                      <span className="text-base-content/70">{e.agent}</span>
                      <span className="text-base-content/60 ml-auto">{new Date(e.ts).toLocaleTimeString()}</span>
                    </div>
                    <p className={`text-sm mt-0.5 leading-relaxed ${isErr ? "text-error" : "text-base-content/70"}`}>{e.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
