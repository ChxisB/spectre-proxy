// Architecture diagram generation tool — produces self-contained HTML files with
// inline SVG, dark/light theme toggle, and export-to-PNG/SVG support.
// Mirrors archify's output format: single-file HTML, zero runtime dependencies.

import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { renderArchitectureSVG, fillTemplate } from "./diagram/render"
import type { ArchitectureDiagram, ComponentType } from "./diagram/types"
import templateContent from "./diagram/template.html.txt" with { type: "text" }

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export const Parameters = Schema.Struct({
  subject: Schema.String.annotate({ description: "What to diagram — e.g., 'the payment flow', 'our microservice architecture', 'deployment topology'" }),
  components: Schema.String.annotate({ description: "List the main components to include. Describe what each one does and how they connect." }),
  highlight: Schema.optional(Schema.String).annotate({ description: "Specific aspect to emphasize (e.g., 'auth flow', 'database layer', 'security boundaries')" }),
})

// ---------------------------------------------------------------------------
// Diagram builder — creates an ArchitectureDiagram JSON IR from the params
// ---------------------------------------------------------------------------

function buildDiagram(subject: string, components: string, highlight: string | undefined): ArchitectureDiagram {
  // Generate a basic architecture diagram from the description.
  // Components are auto-laid out in a simple grid.
  const lines = components.split("\n").filter((l) => l.trim())
  const comps: ArchitectureDiagram["components"] = []
  const conns: ArchitectureDiagram["connections"] = []

  // Parse lines as "name: type: description" or "name -> name"
  let hasConnections = false
  for (const line of lines) {
    const arrowMatch = line.match(/\s*([^->]+)\s*->\s*(.+)/)
    if (arrowMatch) {
      hasConnections = true
      const [_, from, to] = arrowMatch
      conns.push({ from: from.trim(), to: to.trim() })
      continue
    }

    const parts = line.split(":").map((s) => s.trim())
    const name = parts[0] || line.trim()
    let type: ComponentType = "backend"
    let desc = ""
    let tag = ""

    if (parts.length >= 2) {
      const typeStr = parts[1].toLowerCase()
      if (typeStr.includes("front") || typeStr.includes("ui") || typeStr.includes("client")) type = "frontend"
      else if (typeStr.includes("db") || typeStr.includes("database") || typeStr.includes("store") || typeStr.includes("cache")) type = "database"
      else if (typeStr.includes("cloud") || typeStr.includes("aws") || typeStr.includes("gcp") || typeStr.includes("azure")) type = "cloud"
      else if (typeStr.includes("auth") || typeStr.includes("security") || typeStr.includes("firewall")) type = "security"
      else if (typeStr.includes("queue") || typeStr.includes("bus") || typeStr.includes("event")) type = "messagebus"
      else if (typeStr.includes("external") || typeStr.includes("third") || typeStr.includes("user")) type = "external"
      if (parts.length >= 3) desc = parts.slice(2).join(": ")
      if (parts.length >= 4) tag = parts[3]
    }

    comps.push({
      id: name.toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
      type,
      label: name,
      sublabel: desc || undefined,
      tag: tag || undefined,
      pos: [0, 0],
      size: [140, 60],
    })
  }

  // Auto-layout: arrange in a grid (max 4 per row)
  const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(comps.length))))
  const spacingX = 160
  const spacingY = 100
  const startX = 60
  const startY = 120

  for (let i = 0; i < comps.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    comps[i].pos = [startX + col * spacingX, startY + row * spacingY]
  }

  // Auto-connect if no explicit connections given (link sequential components)
  if (!hasConnections && comps.length > 1) {
    for (let i = 0; i < comps.length - 1; i++) {
      conns.push({ from: comps[i].id, to: comps[i + 1].id })
    }
  }

  const cards: ArchitectureDiagram["cards"] = []
  if (highlight) {
    cards.push({
      dot: "emerald",
      title: "Focus",
      items: [highlight],
    })
  }

  cards.push({
    dot: "slate",
    title: " Components",
    items: comps.map((c) => `${c.label} (${c.type})`),
  })

  return {
    schema_version: 1,
    diagram_type: "architecture",
    meta: {
      title: subject,
      subtitle: `Generated diagram: ${subject}`,
    },
    components: comps,
    connections: conns,
    cards,
  }
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const DiagramTool = Tool.define(
  "generate-diagram",
  Effect.gen(function* () {
    // Template is imported at module scope so it gets bundled into the compiled binary
    const template = templateContent

    return {
      description: "Generate a self-contained architecture diagram HTML file. Use when the user wants to visualize system architecture, component relationships, deployment topology, or data flows. BEFORE calling this tool, use Glob/Grep/Bash to explore the user's project to discover the actual architecture — find config files (pubspec.yaml, package.json, Cargo.toml, Dockerfile, docker-compose.yml), look for API routes, database connections, and frontend code. Then call this tool with what you discovered so the diagram reflects their real setup. Produces a single HTML file with inline SVG, dark/light theme toggle, and export-to-PNG/SVG support — zero external dependencies.",
      parameters: Parameters,
      execute: (params: { subject: string; components: string; highlight?: string }, _ctx: Tool.Context) =>
        Effect.sync(() => {
          const diagram = buildDiagram(params.subject, params.components, params.highlight)
          const svg = renderArchitectureSVG(diagram)
          const cardsHTML = diagram.cards
            ? diagram.cards.map((card) => {
                const items = card.items.map((item) => `          <li>${item}</li>`).join("\n")
                return `      <div class="card">
        <div class="card-header">
          <div class="pulse-dot-dot dot-${card.dot}"></div>
          <h3>${card.title}</h3>
        </div>
        <ul>
${items}
        </ul>
      </div>`
              }).join("\n")
            : ""

          const subtitle = `Architecture diagram: ${params.subject}`
          const { html } = fillTemplate(template, diagram, svg, cardsHTML, subtitle)

          return {
            title: `Architecture Diagram: ${params.subject}`,
            metadata: {
              subject: params.subject,
              componentCount: diagram.components.length,
              connectionCount: (diagram.connections ?? []).length,
            } as Record<string, unknown>,
            output: `# Architecture Diagram: ${params.subject}\n\nGenerated a self-contained HTML diagram with ${diagram.components.length} components and ${(diagram.connections ?? []).length} connections.\n\nThe HTML file is a single self-contained page with:\n- Inline SVG architecture diagram\n- Dark/light theme toggle (press T)\n- Export to PNG/SVG (press E)\n- Zero external dependencies\n\nTo view, save the HTML below to a file and open in a browser.\n\n\`\`\`html\n${html}\n\`\`\`\n\nOr paste the subject and components into the prompt and the LLM will generate the diagram inside a \`\`\`html block you can save.`,
          } satisfies Tool.ExecuteResult
        }),
    }
  }),
)

export * as Diagram from "./diagram"
