import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOOLS_CONFIG_PATH = path.join(os.homedir(), ".spectre", "tools.json");

interface ToolConfig {
  enabled: boolean;
  level?: string;
}

interface ToolsState {
  tools: Record<string, ToolConfig>;
}

// Default configuration — all tools enabled
const DEFAULT_CONFIG: ToolsState = {
  tools: {
    synth:    { enabled: true },
    compress: { enabled: true, level: "full" },
    viz:      { enabled: true },
    filter:   { enabled: true },
    usage:    { enabled: true },
    graph:    { enabled: true },
  },
};

const TOOL_DEFINITIONS = [
  {
    id: "synth",
    name: "Synth (Karpathy Principles)",
    description: "Injects Andrej Karpathy's 4 coding principles into agent prompts",
    icon: "brain",
    color: "#8b5cf6",
    configurable: false,
  },
  {
    id: "compress",
    name: "Compress (Output Compression)",
    description: "Compresses LLM output by ~60-75% while preserving technical accuracy",
    icon: "minimize-2",
    color: "#22c55e",
    configurable: true,
    levels: [
      { value: "lite", label: "Lite", desc: "Drop filler words" },
      { value: "full", label: "Full", desc: "Default compression" },
      { value: "ultra", label: "Ultra", desc: "Telegraphic mode" },
    ],
  },
  {
    id: "viz",
    name: "Viz (Diagram Generator)",
    description: "Generates self-contained HTML diagrams from JSON IR",
    icon: "layout",
    color: "#3b82f6",
    configurable: false,
  },
  {
    id: "filter",
    name: "Filter (Command Output)",
    description: "Filters and compresses command output to reduce token usage",
    icon: "filter",
    color: "#f97316",
    configurable: false,
  },
  {
    id: "usage",
    name: "Usage (Token Analytics)",
    description: "Parses session logs and generates token usage reports",
    icon: "bar-chart-2",
    color: "#06b6d4",
    configurable: false,
  },
  {
    id: "graph",
    name: "Graph (Knowledge Graph)",
    description: "Extracts code structure and builds queryable knowledge graphs",
    icon: "share-2",
    color: "#a855f7",
    configurable: false,
  },
];

function loadConfig(): ToolsState {
  try {
    if (existsSync(TOOLS_CONFIG_PATH)) {
      const data = readFileSync(TOOLS_CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(data);
      // Merge with defaults to fill missing keys
      const merged = { ...DEFAULT_CONFIG };
      if (parsed.tools) {
        for (const [key, value] of Object.entries(parsed.tools)) {
          merged.tools[key] = value as ToolConfig;
        }
      }
      return merged;
    }
  } catch {}
  return DEFAULT_CONFIG;
}

function saveConfig(state: ToolsState): void {
  const dir = path.dirname(TOOLS_CONFIG_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(TOOLS_CONFIG_PATH, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * GET /api/spectre-proxy/tools
 * Returns the current tools configuration and definitions.
 */
export async function GET() {
  const config = loadConfig();

  const tools = TOOL_DEFINITIONS.map((def) => ({
    ...def,
    enabled: config.tools[def.id]?.enabled ?? true,
    level: config.tools[def.id]?.level ?? undefined,
  }));

  return NextResponse.json({ tools });
}

/**
 * PUT /api/spectre-proxy/tools
 * Body: { id: string, enabled: boolean, level?: string }
 * Updates a single tool's configuration.
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, enabled, level } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing tool id" }, { status: 400 });
    }

    const def = TOOL_DEFINITIONS.find((d) => d.id === id);
    if (!def) {
      return NextResponse.json({ error: `Unknown tool: ${id}` }, { status: 404 });
    }

    const config = loadConfig();

    if (!config.tools[id]) {
      config.tools[id] = { enabled: true };
    }

    if (typeof enabled === "boolean") {
      config.tools[id].enabled = enabled;
    }

    if (level !== undefined && def.configurable) {
      config.tools[id].level = level;
    }

    saveConfig(config);

    return NextResponse.json({
      ok: true,
      tool: {
        id,
        enabled: config.tools[id].enabled,
        level: config.tools[id].level,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/spectre-proxy/tools
 * Body: { action: "reset" }
 * Resets all tools to default configuration.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "reset") {
      saveConfig(DEFAULT_CONFIG);
      return NextResponse.json({ ok: true, tools: DEFAULT_CONFIG.tools });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 500 }
    );
  }
}
