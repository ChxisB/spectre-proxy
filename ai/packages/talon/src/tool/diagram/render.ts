// Architecture diagram renderer — ports archify's SVG generation to TypeScript.
// Produces self-contained HTML files with inline SVG, dark/light theme, and export.

import type {
  ArchitectureDiagram, Component, ComponentType, Boundary, Connection, Card, ArrowVariant,
  Rect, ResolvedComponent, ResolvedBoundary, Side,
} from "./types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SIZE: [number, number] = [120, 60]
const BOUNDARY_PAD = 30
const MIN_VIEWBOX: [number, number] = [320, 240]

const COMPONENT_FILL: Record<ComponentType, string> = {
  frontend: "c-frontend", backend: "c-backend", database: "c-database",
  cloud: "c-cloud", security: "c-security", messagebus: "c-messagebus", external: "c-external",
}
const COMPONENT_TEXT: Record<ComponentType, string> = {
  frontend: "t-frontend", backend: "t-backend", database: "t-database",
  cloud: "t-cloud", security: "t-security", messagebus: "t-messagebus", external: "t-muted",
}

const ARROW_CLASS_MAP: Record<string, [string, string]> = {
  default: ["a-default", "arrowhead"],
  emphasis: ["a-emphasis", "arrowhead-emphasis"],
  security: ["a-security", "arrowhead-security"],
  dashed: ["a-dashed", "arrowhead-dashed"],
}

function variantAccent(variant?: ArrowVariant): string {
  switch (variant) {
    case "emphasis": return "t-backend"
    case "security": return "t-security"
    case "dashed": return "t-messagebus"
    default: return "t-muted"
  }
}

// ---------------------------------------------------------------------------
// XML escaping
// ---------------------------------------------------------------------------

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, width: w, height: h, cx: x + w / 2, cy: y + h / 2 }
}

function resolveComponent(c: Component): ResolvedComponent {
  const size = c.size ?? DEFAULT_SIZE
  return { ...c, ...rect(c.pos[0], c.pos[1], size[0], size[1]) }
}

function anchor(r: Rect, side: Side): [number, number] {
  switch (side) {
    case "left": return [r.x, r.cy]
    case "right": return [r.x + r.width, r.cy]
    case "top": return [r.cx, r.y]
    case "bottom": return [r.cx, r.y + r.height]
  }
}

function defaultFromSide(from: Rect, to: Rect): Side {
  const dx = to.cx - from.cx
  const dy = to.cy - from.cy
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left"
  return dy > 0 ? "bottom" : "top"
}

function defaultToSide(from: Rect, to: Rect): Side {
  const dx = to.cx - from.cx
  const dy = to.cy - from.cy
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right"
  return dy < 0 ? "top" : "bottom"
}

function chosenSide(side: Side | "auto" | undefined, fallback: Side): Side {
  return side && side !== "auto" ? side : fallback
}

function roundedPath(points: [number, number][], radius: number): string {
  if (points.length < 2) return ""
  if (points.length === 2) return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`

  const parts: string[] = []
  parts.push(`M ${points[0][0]} ${points[0][1]}`)

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]

    const dx1 = curr[0] - prev[0]
    const dy1 = curr[1] - prev[1]
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
    const dx2 = next[0] - curr[0]
    const dy2 = next[1] - curr[1]
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)

    const r = Math.min(radius, len1 / 2, len2 / 2)

    if (r <= 0) {
      parts.push(`L ${curr[0]} ${curr[1]}`)
      continue
    }

    const t1 = r / len1
    const t2 = r / len2

    const mid1x = curr[0] - dx1 * t1
    const mid1y = curr[1] - dy1 * t1
    const mid2x = curr[0] + dx2 * t2
    const mid2y = curr[1] + dy2 * t2

    parts.push(`L ${mid1x} ${mid1y}`)
    parts.push(`Q ${curr[0]} ${curr[1]} ${mid2x} ${mid2y}`)
  }

  const last = points[points.length - 1]
  parts.push(`L ${last[0]} ${last[1]}`)

  return parts.join(" ")
}

function routeVia(conn: Connection, _from: Rect, _to: Rect, start: [number, number], end: [number, number]): [number, number][] {
  if (conn.via && conn.via.length > 0) return conn.via as [number, number][]

  const route = conn.route ?? "auto"
  if (route === "straight") return []

  const dx = end[0] - start[0]
  const dy = end[1] - start[1]

  if (route === "orthogonal-h" || (route === "auto" && Math.abs(dx) > 4 && Math.abs(dy) > 4)) {
    const midX = (start[0] + end[0]) / 2
    return [[midX, start[1]], [midX, end[1]]]
  }

  if (route === "orthogonal-v" || (route === "auto")) {
    const midY = (start[1] + end[1]) / 2
    return [[start[0], midY], [end[0], midY]]
  }

  return []
}

function labelPoint(conn: Connection, points: [number, number][]): [number, number] {
  if (conn.labelAt) return conn.labelAt
  const segment = conn.labelSegment ?? 1
  const idx = Math.min(segment, points.length - 1)
  const from = points[idx - 1]
  const to = points[idx]
  if (!from || !to) return points[Math.floor(points.length / 2)]
  return [((from[0] + to[0]) / 2) + (conn.labelDx ?? 0), ((from[1] + to[1]) / 2) + (conn.labelDy ?? 0)]
}

function textUnits(text: string): number {
  let units = 0
  for (const ch of text) {
    units += ch.charCodeAt(0) > 0x2e80 ? 2 : 1
  }
  return units
}

// ---------------------------------------------------------------------------
// Boundary rect computation
// ---------------------------------------------------------------------------

function resolveBoundary(b: Boundary, components: Map<string, ResolvedComponent>): ResolvedBoundary | null {
  const wrapped = b.wraps.map((id) => components.get(id)).filter((c): c is ResolvedComponent => !!c)
  if (wrapped.length === 0) return null

  const pad = b.pad ?? BOUNDARY_PAD
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const c of wrapped) {
    minX = Math.min(minX, c.x)
    minY = Math.min(minY, c.y)
    maxX = Math.max(maxX, c.x + c.width)
    maxY = Math.max(maxY, c.y + c.height)
  }

  return {
    ...b,
    ...rect(minX - pad, minY - pad, (maxX - minX) + pad * 2, (maxY - minY) + pad * 2),
  }
}

// ---------------------------------------------------------------------------
// ViewBox computation
// ---------------------------------------------------------------------------

function autoViewBox(components: ResolvedComponent[], boundaries: ResolvedBoundary[]): string {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  for (const c of components) {
    minX = Math.min(minX, c.x)
    minY = Math.min(minY, c.y)
    maxX = Math.max(maxX, c.x + c.width)
    maxY = Math.max(maxY, c.y + c.height)
  }
  for (const b of boundaries) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.width)
    maxY = Math.max(maxY, b.y + b.height)
  }

  const pad = 40
  const w = Math.max(MIN_VIEWBOX[0], Math.ceil(maxX - minX + pad * 2))
  const h = Math.max(MIN_VIEWBOX[1], Math.ceil(maxY - minY + pad * 2))
  return `${Math.floor(minX - pad)} ${Math.floor(minY - pad)} ${w} ${h}`
}

// ---------------------------------------------------------------------------
// SVG renderers
// ---------------------------------------------------------------------------

function renderDefinitions(): string {
  const defs = `<defs>
  <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
    <polygon points="0 0, 10 5, 0 10" class="m-default"/>
  </marker>
  <marker id="arrowhead-emphasis" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
    <polygon points="0 0, 10 5, 0 10" class="m-emphasis"/>
  </marker>
  <marker id="arrowhead-security" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
    <polygon points="0 0, 10 5, 0 10" class="m-security"/>
  </marker>
  <marker id="arrowhead-dashed" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
    <polygon points="0 0, 10 5, 0 10" class="m-dashed"/>
  </marker>
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M 40 0 L 0 0 0 40" fill="none" class="c-grid" stroke-width="0.5"/>
  </pattern>
</defs>`
  return defs
}

function renderComponent(c: ResolvedComponent): string {
  const fill = COMPONENT_FILL[c.type] ?? "c-external"
  const accent = COMPONENT_TEXT[c.type] ?? "t-muted"
  const cx = c.cx
  const hasSub = c.sublabel != null && c.sublabel !== ""
  const labelY = hasSub ? c.y + c.height / 2 - 2 : c.y + c.height / 2 + 4
  const sub = hasSub ? `\n        <text x="${cx}" y="${c.y + c.height / 2 + 14}" class="${accent}" font-size="9" text-anchor="middle">${esc(c.sublabel!)}</text>` : ""
  const tag = c.tag ? `\n        <text x="${cx}" y="${c.y + c.height - 8}" class="${accent}" font-size="7" text-anchor="middle">${esc(c.tag)}</text>` : ""
  return `        <rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}" rx="6" class="c-mask"/>
        <rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}" rx="6" class="${fill}" stroke-width="1.5"/>
        <text x="${cx}" y="${labelY}" class="t-primary" font-size="11" font-weight="600" text-anchor="middle">${esc(c.label)}</text>${sub}${tag}`
}

function renderConnectionPath(conn: Connection, from: ResolvedComponent, to: ResolvedComponent): string {
  const [cls, marker] = ARROW_CLASS_MAP[conn.variant ?? "default"] ?? ARROW_CLASS_MAP.default
  const fSide = chosenSide(conn.fromSide, defaultFromSide(from, to))
  const tSide = chosenSide(conn.toSide, defaultToSide(from, to))
  const start = anchor(from, fSide)
  const end = anchor(to, tSide)
  const points: [number, number][] = [start, ...routeVia(conn, from, to, start, end), end]
  const d = roundedPath(points, 8)
  const strokeWidth = conn.width ?? (conn.variant === "emphasis" ? 1.8 : 1.5)
  return `        <path d="${d}" class="${cls}" stroke-width="${strokeWidth}" marker-end="url(#${marker})"/>`
}

function renderConnectionLabel(conn: Connection): string {
  if (!conn.label) return ""
  // Need the points — compute them again
  const fSide = chosenSide(conn.fromSide, "right")
  const tSide = chosenSide(conn.toSide, "left")
  const [lx, ly] = [0, 0] // placeholder; actual computation done in full render
  const w = Math.max(30, textUnits(conn.label) * 4.8 + 10)
  const accent = variantAccent(conn.variant)
  return `        <rect x="${lx - w / 2}" y="${ly - 10}" width="${w}" height="14" rx="3" class="c-mask"/>
        <text x="${lx}" y="${ly}" class="${accent}" font-size="8" text-anchor="middle">${esc(conn.label)}</text>`
}

function renderBoundary(b: ResolvedBoundary): string {
  const cls = b.kind === "security-group" ? "c-security-group" : "c-region"
  const labelCls = b.kind === "security-group" ? "t-security" : "t-cloud"
  const rx = b.kind === "security-group" ? 8 : 12
  return `        <rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${rx}" class="${cls}" stroke-width="1"/>
        <text x="${b.x + 8}" y="${b.y + 18}" class="${labelCls}" font-size="9" font-weight="600">${esc(b.label)}</text>`
}

function renderLegend(usedTypes: Set<ComponentType>): string {
  const typeNames: Record<ComponentType, string> = {
    frontend: "Frontend", backend: "Backend", database: "Database",
    cloud: "Cloud", security: "Security", messagebus: "Message Bus", external: "External",
  }
  const entries = Array.from(usedTypes).map((type) => {
    const fill = COMPONENT_FILL[type] ?? "c-external"
    return `        <rect x="40" y="564" width="14" height="9" rx="2" class="${fill}" stroke-width="0.8"/>
        <text x="60" y="572" class="t-muted" font-size="8">${typeNames[type] ?? type}</text>`
  })
  if (entries.length === 0) return ""
  return `      <text x="40" y="559" class="t-primary" font-size="9" font-weight="600">Legend</text>
${entries.join("\n")}`
}

function renderCards(cards: Card[]): string {
  if (cards.length === 0) return ""
  return cards.map((card) => {
    const items = card.items.map((item) => `          <li>${esc(item)}</li>`).join("\n")
    return `      <div class="card">
        <div class="card-header">
          <div class="pulse-dot-dot dot-${card.dot}"></div>
          <h3>${esc(card.title)}</h3>
        </div>
        <ul>
${items}
        </ul>
      </div>`
  }).join("\n")
}

// ---------------------------------------------------------------------------
// Connection label rendering (with correct positions)
// ---------------------------------------------------------------------------

interface ConnectionRenderInfo {
  path: string
  points: [number, number][]
}

function renderConnection(c: Connection, from: ResolvedComponent, to: ResolvedComponent): ConnectionRenderInfo {
  const fSide = chosenSide(c.fromSide, defaultFromSide(from, to))
  const tSide = chosenSide(c.toSide, defaultToSide(from, to))
  const start = anchor(from, fSide)
  const end = anchor(to, tSide)
  const points: [number, number][] = [start, ...routeVia(c, from, to, start, end), end]
  const d = roundedPath(points, 8)
  return { path: d, points }
}

function connectionLabelHTML(conn: Connection, cinfo: ConnectionRenderInfo): string {
  if (!conn.label) return ""
  const [lx, ly] = labelPoint(conn, cinfo.points)
  const w = Math.max(30, textUnits(conn.label) * 4.8 + 10)
  const accent = variantAccent(conn.variant)
  return `        <rect x="${(lx - w / 2).toFixed(1)}" y="${(ly - 10).toFixed(1)}" width="${w}" height="14" rx="3" class="c-mask"/>
        <text x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" class="${accent}" font-size="8" text-anchor="middle">${esc(conn.label)}</text>`
}

// ---------------------------------------------------------------------------
// Main SVG render function
// ---------------------------------------------------------------------------

export function renderArchitectureSVG(diagram: ArchitectureDiagram): string {
  // Resolve components
  const compMap = new Map<string, ResolvedComponent>()
  const compList = diagram.components.map((c) => {
    const resolved = resolveComponent(c)
    compMap.set(resolved.id, resolved)
    return resolved
  })

  // Resolve boundaries
  const boundaries = (diagram.boundaries ?? [])
    .map((b) => resolveBoundary(b, compMap))
    .filter((b): b is ResolvedBoundary => b !== null)

  // Compute viewBox
  const explicitViewBox = diagram.meta.viewBox
  const vb = explicitViewBox
    ? `${0} ${0} ${Math.max(MIN_VIEWBOX[0], explicitViewBox[0])} ${Math.max(MIN_VIEWBOX[1], explicitViewBox[1])}`
    : autoViewBox(compList, boundaries)

  // Pre-compute connection paths + required info
  const connections = (diagram.connections ?? []).map((c) => {
    const from = compMap.get(c.from)
    const to = compMap.get(c.to)
    if (!from || !to) return null
    return { conn: c, from, to, info: renderConnection(c, from, to) }
  }).filter((c): c is NonNullable<typeof c> => !!c)

  // Collect used component types for legend
  const usedTypes = new Set(compList.map((c) => c.type))

  // Build SVG parts
  const parts: string[] = []

  // Boundaries (behind everything)
  for (const b of boundaries) {
    parts.push(renderBoundary(b))
  }

  // Connection paths (before components for correct z-order)
  for (const { conn, info } of connections) {
    const [cls, marker] = ARROW_CLASS_MAP[conn.variant ?? "default"] ?? ARROW_CLASS_MAP.default
    const strokeWidth = conn.width ?? (conn.variant === "emphasis" ? 1.8 : 1.5)
    parts.push(`        <path d="${info.path}" class="${cls}" stroke-width="${strokeWidth}" marker-end="url(#${marker})"/>`)
  }

  // Components
  for (const c of compList) {
    parts.push(renderComponent(c))
  }

  // Connection labels (on top of everything)
  for (const { conn, info } of connections) {
    const label = connectionLabelHTML(conn, info)
    if (label) parts.push(label)
  }

  // Legend
  parts.push(renderLegend(usedTypes))

  return `<svg viewBox="${vb}" role="img" aria-label="${esc(diagram.meta.title)} — ${esc(diagram.meta.subtitle ?? "Architecture Diagram")} — architecture diagram">
  ${renderDefinitions()}
  <rect width="100%" height="100%" fill="url(#grid)" />
${parts.join("\n")}
</svg>`
}

// ---------------------------------------------------------------------------
// Template filler
// ---------------------------------------------------------------------------

type TemplateResult = {
  html: string
  svgLineCount: number
}

export function fillTemplate(
  template: string,
  diagram: ArchitectureDiagram,
  svg: string,
  cardsHTML: string,
  subtitle: string,
): TemplateResult {
  let result = template
  const title = diagram.meta.title

  // Replace title placeholders
  result = result.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)} Diagram</title>`)
  result = result.replace(/<h1>[^<]*<\/h1>/, `<h1>${esc(title)}</h1>`)
  result = result.replace(/<p class="subtitle">[^<]*<\/p>/, `<p class="subtitle">${esc(subtitle)}</p>`)

  // Replace SVG slot
  result = result.replace(/<!-- ARCHIFY:SVG_SLOT_START -->[\s\S]*?<!-- ARCHIFY:SVG_SLOT_END -->/,
    `<!-- ARCHIFY:SVG_SLOT_START -->\n${svg}\n      <!-- ARCHIFY:SVG_SLOT_END -->`)

  // Replace cards slot
  const cardsContent = cardsHTML || `<div class="cards"></div>`
  result = result.replace(/<!-- ARCHIFY:CARDS_SLOT_START -->[\s\S]*?<!-- ARCHIFY:CARDS_SLOT_END -->/,
    `<!-- ARCHIFY:CARDS_SLOT_START -->\n${cardsContent}\n    <!-- ARCHIFY:CARDS_SLOT_END -->`)

  // Replace footer
  result = result.replace(/\[Project Name\]/g, esc(title))

  const svgLineCount = svg.split("\n").length
  return { html: result, svgLineCount }
}

export * as DiagramRender from "./render"
