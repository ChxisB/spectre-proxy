// JSON IR types for architecture diagrams.
// Mirrors archify's architecture.schema.json.

export type ComponentType = "frontend" | "backend" | "database" | "cloud" | "security" | "messagebus" | "external"
export type BoundaryKind = "region" | "security-group"
export type ArrowVariant = "default" | "emphasis" | "security" | "dashed"
export type Side = "left" | "right" | "top" | "bottom"
export type DotColor = "cyan" | "emerald" | "violet" | "amber" | "rose" | "orange" | "slate"

export interface Component {
  id: string
  type: ComponentType
  label: string
  sublabel?: string
  tag?: string
  pos: [number, number]
  size?: [number, number]
}

export interface Boundary {
  kind: BoundaryKind
  label: string
  wraps: string[]
  pad?: number
}

export interface Connection {
  from: string
  to: string
  label?: string
  variant?: ArrowVariant
  fromSide?: Side | "auto"
  toSide?: Side | "auto"
  route?: "auto" | "straight" | "orthogonal-h" | "orthogonal-v"
  via?: [number, number][]
  labelAt?: [number, number]
  labelDx?: number
  labelDy?: number
  labelSegment?: number
  width?: number
}

export interface Card {
  dot: DotColor
  title: string
  items: string[]
}

export interface DiagramMeta {
  title: string
  subtitle?: string
  viewBox?: [number, number]
}

export interface ArchitectureDiagram {
  schema_version: number
  diagram_type: "architecture"
  meta: DiagramMeta
  components: Component[]
  boundaries?: Boundary[]
  connections?: Connection[]
  cards?: Card[]
}

// Internal types (computed during rendering)
export interface Rect {
  x: number
  y: number
  width: number
  height: number
  cx: number
  cy: number
}

export interface ResolvedComponent extends Component, Rect {}
export interface ResolvedBoundary extends Boundary, Rect {}

export * as DiagramTypes from "./types"
