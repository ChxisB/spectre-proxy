"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Brain, BookOpen } from "lucide-react";

const VaultGraph3D = dynamic(() => import("@/components/VaultGraph3D"), { ssr: false });

interface VaultNote { path: string; title: string; group: string; mtime: number; }

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-1 h-6 rounded-full bg-primary" />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-base-content/70 shrink-0">{icon}</span>
        <h2 className="font-bold text-sm tracking-tight">{title}</h2>
      </div>
      {count !== undefined && <span className="badge badge-sm">{count}</span>}
    </div>
  );
}

export default function MemoryPage() {
  const [notes, setNotes] = useState<VaultNote[]>([]);
  const [query, setQuery] = useState("");
  const [selectedNote, setSelectedNote] = useState<{ path: string; content: string } | null>(null);
  const [loadingNote, setLoadingNote] = useState(false);
  const [view, setView] = useState<"graph" | "list">("graph");

  useEffect(() => {
    fetch("/api/vault/notes").then(r => r.json()).then(d => setNotes(d.notes || [])).catch(() => {});
  }, []);

  const openNote = async (path: string) => {
    setLoadingNote(true);
    try {
      const r = await fetch(`/api/vault/notes?path=${encodeURIComponent(path)}`);
      const d = await r.json();
      if (d.content) setSelectedNote({ path: d.path, content: d.content });
    } catch {}
    setLoadingNote(false);
  };

  const filtered = query ? notes.filter(n => n.title.toLowerCase().includes(query.toLowerCase()) || n.path.toLowerCase().includes(query.toLowerCase())) : notes;

  return (
    <div className="flex flex-col gap-6">

      {/* Tabs */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="tabs tabs-box bg-base-200 border border-base-content/10">
          <button className={`tab tab-sm ${view === "graph" ? "tab-active" : ""}`} onClick={() => setView("graph")}>
            <Brain size={14} className="mr-1" /> Graph
          </button>
          <button className={`tab tab-sm ${view === "list" ? "tab-active" : ""}`} onClick={() => setView("list")}>
            <BookOpen size={14} className="mr-1" /> Notes
          </button>
        </div>
        {view === "list" && (
          <label className="input input-bordered flex items-center gap-2 max-w-xs bg-base-200 border-base-content/20">
            <span className="material-symbols-outlined text-base-content/60 text-sm">search</span>
            <input type="text" className="grow" placeholder="Search notes..." value={query} onChange={e => setQuery(e.target.value)} />
          </label>
        )}
      </div>

      {/* Graph View */}
      {view === "graph" && (
        <div className="rounded-xl bg-base-200 border border-base-content/10 overflow-hidden shadow-sm" style={{ minHeight: "60vh" }}>
          <VaultGraph3D />
          {notes.length > 0 && (
            <div className="absolute top-4 right-4 z-10 badge badge-lg badge-outline bg-base-200/80 backdrop-blur-sm">
              {notes.length} notes in vault
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Notes list */}
          <div className="rounded-xl bg-base-200 border border-base-content/10 p-5 shadow-sm max-h-[70vh] overflow-y-auto">
            <SectionHeader icon={<BookOpen size={16} />} title="Notes" count={filtered.length} />
            <div className="flex flex-col gap-1.5">
              {filtered.map(n => (
                <button key={n.path} onClick={() => openNote(n.path)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-base-300 border border-base-content/5 hover:border-primary/30 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Brain size={14} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-base-content/90 truncate">{n.title}</div>
                    <div className="text-xs text-base-content/70 mt-0.5">{n.group} · {new Date(n.mtime).toLocaleDateString()}</div>
                  </div>
                  <span className="material-symbols-outlined text-base-content/70 text-sm">chevron_right</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-8 text-sm text-base-content/60">No notes found.</div>
              )}
            </div>
          </div>

          {/* Note content */}
          <div className="rounded-xl bg-base-200 border border-base-content/10 p-5 shadow-sm max-h-[70vh] overflow-y-auto">
            {loadingNote && (
              <div className="flex items-center justify-center h-32">
                <span className="loading loading-spinner loading-md" />
              </div>
            )}
            {!loadingNote && selectedNote && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm truncate pr-2">{selectedNote.path}</h3>
                  <button className="btn btn-ghost btn-sm btn-square shrink-0" onClick={() => setSelectedNote(null)}>
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-base-content/80 bg-base-300 rounded-lg p-4">
                  {selectedNote.content}
                </div>
              </>
            )}
            {!loadingNote && !selectedNote && (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Brain size={32} className="text-base-content/60 mb-3" />
                <p className="text-sm text-base-content/60">Select a note to view its content</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
