"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw } from "lucide-react";

export default function MemoryPage() {
  const [kgHtml, setKgHtml] = useState<string | null>(null);
  const [kgStatus, setKgStatus] = useState<string>("No graph loaded");
  const [kgLoading, setKgLoading] = useState(false);
  const [kgQuery, setKgQuery] = useState("");
  const [kgResults, setKgResults] = useState<string | null>(null);

  // Load knowledge graph status on mount
  useEffect(() => {
    fetch("/api/spectre-proxy/knowledge")
      .then(r => r.json())
      .then(data => {
        if (data.exists) {
          setKgHtml(data.html);
          setKgStatus(`Loaded (built ${new Date(data.lastBuilt).toLocaleString()})`);
        }
      })
      .catch(() => {});
  }, []);

  const buildGraph = useCallback(async () => {
    setKgLoading(true);
    setKgStatus("Building graph...");
    try {
      const res = await fetch("/api/spectre-proxy/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "build", path: "." }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKgStatus(data.result || "Graph built");

      const vizRes = await fetch("/api/spectre-proxy/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "visualize" }),
      });
      const vizData = await vizRes.json();
      if (vizData.html) setKgHtml(vizData.html);
    } catch (err: any) {
      setKgStatus(`Error: ${err.message}`);
    } finally {
      setKgLoading(false);
    }
  }, []);

  const runKgQuery = useCallback(async () => {
    if (!kgQuery) return;
    setKgResults("Querying...");
    try {
      const res = await fetch("/api/spectre-proxy/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "query", queryType: "search", param1: kgQuery, param2: "" }),
      });
      const data = await res.json();
      setKgResults(data.result || "No results");
    } catch (err: any) {
      setKgResults(`Error: ${err.message}`);
    }
  }, [kgQuery]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header with build controls */}
      <div className="rounded-xl bg-base-200 border border-base-content/10 p-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: "18px" }}>hub</span>
            </div>
            <div>
              <div className="font-bold text-sm">Code Knowledge Graph</div>
              <div className="text-xs text-base-content/60">{kgStatus}</div>
            </div>
          </div>
          <button onClick={buildGraph} disabled={kgLoading} className="btn btn-primary btn-sm gap-2">
            <RefreshCw size={14} className={kgLoading ? "animate-spin" : ""} />
            {kgLoading ? "Building..." : "Build Graph"}
          </button>
        </div>

        {/* Query bar */}
        <div className="flex gap-2 mt-4">
          <label className="input input-bordered flex items-center gap-2 flex-1 bg-base-300 border-base-content/20">
            <Search size={14} className="text-base-content/60" />
            <input type="text" className="grow" placeholder="Search codebase (function, type, file...)" value={kgQuery}
              onChange={e => setKgQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && runKgQuery()} />
          </label>
          <button onClick={runKgQuery} className="btn btn-primary btn-sm gap-1"><Search size={14} /> Query</button>
        </div>
      </div>

      {/* Query results */}
      {kgResults && (
        <div className="p-4 rounded-xl bg-base-200 border border-base-content/10 shadow-sm">
          <pre className="text-xs font-mono whitespace-pre-wrap text-base-content/80 leading-relaxed">{kgResults}</pre>
        </div>
      )}

      {/* Visualization */}
      <div className="rounded-xl bg-white border border-base-content/10 overflow-hidden shadow-sm min-h-[400px] relative">
        {kgHtml ? (
          <iframe srcDoc={kgHtml} className="w-full h-[600px]" title="Knowledge Graph" sandbox="allow-scripts allow-same-origin" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-base-content/30 text-sm">
            <div className="text-center">
              <div className="text-5xl mb-3 opacity-50">&#9670;</div>
              <p className="text-base font-medium">No knowledge graph yet</p>
              <p className="mt-1">Click "Build Graph" to analyse your codebase</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
