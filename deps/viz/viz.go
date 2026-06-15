// Package viz generates self-contained HTML diagrams from JSON intermediate
// representations. Supports architecture, workflow, sequence, dataflow, and
// lifecycle diagram types.
//
// Reference: archify (MIT License)
package viz

import (
	"encoding/json"
	"fmt"
	"strings"
)

// DiagramType enumerates the supported diagram types.
type DiagramType string

const (
	TypeArchitecture DiagramType = "architecture"
	TypeWorkflow     DiagramType = "workflow"
	TypeSequence     DiagramType = "sequence"
	TypeDataflow     DiagramType = "dataflow"
	TypeLifecycle    DiagramType = "lifecycle"
)

// Meta holds diagram metadata.
type Meta struct {
	Title    string  `json:"title"`
	Subtitle string  `json:"subtitle,omitempty"`
	Output   string  `json:"output,omitempty"`
	ViewBox  *[2]int `json:"viewBox,omitempty"`
}

// Component represents a diagram node (architecture type).
type Component struct {
	ID       string  `json:"id"`
	Type     string  `json:"type"`
	Label    string  `json:"label"`
	Sublabel string  `json:"sublabel,omitempty"`
	Tag      string  `json:"tag,omitempty"`
	Pos      [2]float64 `json:"pos"`
	Size     *[2]float64 `json:"size,omitempty"`
}

// Boundary wraps a group of components.
type Boundary struct {
	Kind   string   `json:"kind"`
	Label  string   `json:"label"`
	Wraps  []string `json:"wraps"`
	Pad    *float64 `json:"pad,omitempty"`
}

// Connection links two components.
type Connection struct {
	From          string    `json:"from"`
	To            string    `json:"to"`
	Label         string    `json:"label,omitempty"`
	Variant       string    `json:"variant,omitempty"`
	FromSide      string    `json:"fromSide,omitempty"`
	ToSide        string    `json:"toSide,omitempty"`
	Route         string    `json:"route,omitempty"`
	Via           *[][2]float64 `json:"via,omitempty"`
	LabelAt       *Point    `json:"labelAt,omitempty"`
	LabelDx       float64   `json:"labelDx,omitempty"`
	LabelDy       float64   `json:"labelDy,omitempty"`
	LabelSegment  *int      `json:"labelSegment,omitempty"`
	Width         float64   `json:"width,omitempty"`
}

// Point is a 2D coordinate.
type Point = [2]float64

// Card is an info card rendered below the diagram.
type Card struct {
	Dot   string   `json:"dot"`
	Title string   `json:"title"`
	Items []string `json:"items"`
}

// Step is a node in workflow/sequence/lifecycle diagrams.
type Step struct {
	ID      string  `json:"id"`
	Label   string  `json:"label"`
	Type    string  `json:"type,omitempty"`
	Shape   string  `json:"shape,omitempty"`
	Subtext string  `json:"subtext,omitempty"`
	Pos     Point   `json:"pos"`
}

// Transition is an edge in workflow/lifecycle diagrams.
type Transition struct {
	From  string `json:"from"`
	To    string `json:"to"`
	Label string `json:"label,omitempty"`
}

// SequenceMessage is a message in a sequence diagram.
type SequenceMessage struct {
	From  string `json:"from"`
	To    string `json:"to"`
	Label string `json:"label"`
	Type  string `json:"type,omitempty"` // "sync", "async", "return"
}

// SequenceParticipant is a participant in a sequence diagram.
type SequenceParticipant struct {
	ID    string  `json:"id"`
	Label string  `json:"label"`
	Pos   Point   `json:"pos"`
	Type  string  `json:"type,omitempty"` // "actor", "system", "database"
}

// FlowNode is a node in a dataflow diagram.
type FlowNode struct {
	ID    string  `json:"id"`
	Label string  `json:"label"`
	Type  string  `json:"type,omitempty"` // "source", "process", "store", "sink"
	Pos   Point   `json:"pos"`
}

// FlowEdge is an edge in a dataflow diagram.
type FlowEdge struct {
	From  string `json:"from"`
	To    string `json:"to"`
	Label string `json:"label,omitempty"`
}

// Diagram is the top-level IR for all diagram types.
type Diagram struct {
	SchemaVersion int            `json:"schema_version"`
	DiagramType   DiagramType    `json:"diagram_type"`
	Meta          Meta           `json:"meta"`
	Components    []Component    `json:"components,omitempty"`
	Boundaries    []Boundary     `json:"boundaries,omitempty"`
	Connections   []Connection   `json:"connections,omitempty"`
	Steps         []Step         `json:"steps,omitempty"`
	Transitions   []Transition   `json:"transitions,omitempty"`
	Messages      []SequenceMessage `json:"messages,omitempty"`
	Participants  []SequenceParticipant `json:"participants,omitempty"`
	Nodes         []FlowNode     `json:"nodes,omitempty"`
	Edges         []FlowEdge     `json:"edges,omitempty"`
	Cards         []Card         `json:"cards,omitempty"`
}

// Generate creates a self-contained HTML file from a Diagram IR.
func Generate(diagram *Diagram) ([]byte, error) {
	if diagram.Meta.Title == "" {
		return nil, fmt.Errorf("diagram must have a meta.title")
	}

	var svg string
	switch diagram.DiagramType {
	case TypeArchitecture:
		svg = renderArchitecture(diagram)
	case TypeWorkflow:
		svg = renderWorkflow(diagram)
	case TypeSequence:
		svg = renderSequence(diagram)
	case TypeDataflow:
		svg = renderDataflow(diagram)
	case TypeLifecycle:
		svg = renderLifecycle(diagram)
	default:
		return nil, fmt.Errorf("unsupported diagram type: %s", diagram.DiagramType)
	}

	html := applyTemplate(diagram.Meta, svg, renderCards(diagram.Cards), string(diagram.DiagramType))
	return []byte(html), nil
}

// Parse parses a JSON IR string into a Diagram.
func Parse(data []byte) (*Diagram, error) {
	var d Diagram
	if err := json.Unmarshal(data, &d); err != nil {
		return nil, fmt.Errorf("invalid diagram JSON: %w", err)
	}
	return &d, nil
}

// --- Geometry helpers ---

func asArray[T any](v []T) []T {
	if v == nil {
		return []T{}
	}
	return v
}

func esc(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	return s
}

func anchor(x, y, w, h float64, side string) Point {
	cx, cy := x+w/2, y+h/2
	switch side {
	case "left":
		return Point{x, cy}
	case "right":
		return Point{x + w, cy}
	case "top":
		return Point{cx, y}
	case "bottom":
		return Point{cx, y + h}
	default:
		return Point{x + w, cy}
	}
}

func defaultFromSide(fromX, fromY, fromW, fromH, toX, toY float64) string {
	fromCx := fromX + fromW/2
	toCx := toX
	if toCx < fromCx {
		return "left"
	}
	if toCx > fromCx {
		return "right"
	}
	if toY > fromY+fromH/2 {
		return "bottom"
	}
	return "top"
}

func defaultToSide(fromX, fromY, fromW, fromH, toX, toY, toW, toH float64) string {
	fromCx := fromX + fromW/2
	toCx := toX + toW/2
	if toCx < fromCx {
		return "right"
	}
	if toCx > fromCx {
		return "left"
	}
	if toY > fromY+fromH/2 {
		return "top"
	}
	return "bottom"
}

func polylinePath(points []Point) string {
	var b strings.Builder
	for i, p := range points {
		if i == 0 {
			b.WriteString(fmt.Sprintf("M %g %g", p[0], p[1]))
		} else {
			b.WriteString(fmt.Sprintf(" L %g %g", p[0], p[1]))
		}
	}
	return b.String()
}

func roundedPath(points []Point, radius float64) string {
	if len(points) < 3 || radius <= 0 {
		return polylinePath(points)
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("M %g %g", points[0][0], points[0][1]))

	for i := 1; i < len(points)-1; i++ {
		px, py := points[i-1][0], points[i-1][1]
		cx, cy := points[i][0], points[i][1]
		nx, ny := points[i+1][0], points[i+1][1]

		prevLen := dist(px, py, cx, cy)
		nextLen := dist(cx, cy, nx, ny)
		r := radius
		if prevLen/2 < r {
			r = prevLen / 2
		}
		if nextLen/2 < r {
			r = nextLen / 2
		}

		if r < 1 {
			b.WriteString(fmt.Sprintf(" L %g %g", cx, cy))
			continue
		}

		bx := cx - (cx-px)/prevLen*r
		by := cy - (cy-py)/prevLen*r
		ax := cx + (nx-cx)/nextLen*r
		ay := cy + (ny-cy)/nextLen*r

		b.WriteString(fmt.Sprintf(" L %g %g", bx, by))
		b.WriteString(fmt.Sprintf(" Q %g %g %g %g", cx, cy, ax, ay))
	}

	end := points[len(points)-1]
	b.WriteString(fmt.Sprintf(" L %g %g", end[0], end[1]))
	return b.String()
}

func dist(x1, y1, x2, y2 float64) float64 {
	dx, dy := x2-x1, y2-y1
	return dx*dx + dy*dy
}

func labelPoint(conn *Connection, points []Point) Point {
	if conn.LabelAt != nil {
		return *conn.LabelAt
	}
	if len(points) == 2 {
		return Point{
			(points[0][0] + points[1][0]) / 2 + conn.LabelDx,
			points[0][1] - 10 + conn.LabelDy,
		}
	}
	seg := 1
	if conn.LabelSegment != nil {
		seg = *conn.LabelSegment
	}
	if seg >= len(points)-1 {
		seg = len(points) - 2
	}
	if seg < 0 {
		seg = 0
	}
	a, b := points[seg], points[seg+1]
	return Point{
		(a[0] + b[0]) / 2 + conn.LabelDx,
		(a[1] + b[1]) / 2 - 10 + conn.LabelDy,
	}
}

// --- Architecture renderer ---

func renderArchitecture(d *Diagram) string {
	const (
		defaultW     = 120
		defaultH     = 60
		margin       = 40
		boundaryPad  = 30
		extraBottom  = 20
		legendH      = 28
	)

	type measuredComponent struct {
		Component
		x, y, width, height, cx, cy float64
	}

	compMap := make(map[string]*measuredComponent)
	for _, c := range asArray(d.Components) {
		w, h := 120.0, 60.0
		if c.Size != nil {
			w, h = c.Size[0], c.Size[1]
		}
		mc := &measuredComponent{
			Component: c,
			x: c.Pos[0], y: c.Pos[1], width: w, height: h,
			cx: c.Pos[0] + w/2, cy: c.Pos[1] + h/2,
		}
		compMap[c.ID] = mc
	}

	// Compute boundaries
	type boundaryRect struct {
		Boundary
		x, y, width, height float64
	}
	var bounds []boundaryRect
	for _, b := range asArray(d.Boundaries) {
		members := make([]*measuredComponent, 0)
		for _, id := range asArray(b.Wraps) {
			if mc, ok := compMap[id]; ok {
				members = append(members, mc)
			}
		}
		if len(members) == 0 {
			continue
		}
		minX, minY := members[0].x, members[0].y
		maxX, maxY := members[0].x+members[0].width, members[0].y+members[0].height
		for _, m := range members[1:] {
			if m.x < minX {
				minX = m.x
			}
			if m.y < minY {
				minY = m.y
			}
			if m.x+m.width > maxX {
				maxX = m.x + m.width
			}
			if m.y+m.height > maxY {
				maxY = m.y + m.height
			}
		}
		pad := 30.0
		bounds = append(bounds, boundaryRect{
			Boundary: b,
			x: minX - pad, y: minY - pad,
			width: maxX - minX + pad*2, height: maxY - minY + pad + 20,
		})
	}

	// Auto viewBox
	maxX, maxY := 0.0, 0.0
	for _, mc := range compMap {
		if mc.x+mc.width > maxX {
			maxX = mc.x + mc.width
		}
		if mc.y+mc.height > maxY {
			maxY = mc.y + mc.height
		}
	}
	for _, b := range bounds {
		if b.x+b.width > maxX {
			maxX = b.x + b.width
		}
		if b.y+b.height > maxY {
			maxY = b.y + b.height
		}
	}
	vbW, vbH := maxX+margin, maxY+margin+legendH

	// Render SVG
	var svg strings.Builder
	svg.WriteString(fmt.Sprintf(`<svg viewBox="0 0 %g %g" role="img" aria-label="%s — architecture diagram">`, vbW, vbH, esc(d.Meta.Title)))
	svg.WriteString(renderDefs())
	svg.WriteString(`<rect width="100%" height="100%" fill="url(#grid)"/>`)

	// Boundaries
	for _, b := range bounds {
		cls := "c-region"
		if b.Kind == "security-group" {
			cls = "c-security-group"
		}
		rx := 12.0
		if b.Kind == "security-group" {
			rx = 8
		}
		svg.WriteString(fmt.Sprintf(`<rect x="%g" y="%g" width="%g" height="%g" rx="%g" class="%s" stroke-width="1"/>`,
			b.x, b.y, b.width, b.height, rx, cls))
		svg.WriteString(fmt.Sprintf(`<text x="%g" y="%g" class="t-cloud" font-size="9" font-weight="600">%s</text>`,
			b.x+8, b.y+18, esc(b.Label)))
	}

	// Connections
	connCache := make(map[string][]Point)
	for _, conn := range asArray(d.Connections) {
		from, ok1 := compMap[conn.From]
		to, ok2 := compMap[conn.To]
		if !ok1 || !ok2 {
			continue
		}
		fromSide := conn.FromSide
		if fromSide == "" || fromSide == "auto" {
			fromSide = defaultFromSide(from.x, from.y, from.width, from.height, to.x, to.y)
		}
		toSide := conn.ToSide
		if toSide == "" || toSide == "auto" {
			toSide = defaultToSide(from.x, from.y, from.width, from.height, to.x, to.y, to.width, to.height)
		}
		start := anchor(from.x, from.y, from.width, from.height, fromSide)
		end := anchor(to.x, to.y, to.width, to.height, toSide)

		points := []Point{start}
		if conn.Via != nil {
			for _, v := range *conn.Via {
				points = append(points, v)
			}
		} else {
			// Auto routing
			if abs(start[0]-end[0]) >= 4 && abs(start[1]-end[1]) >= 4 {
				midX := (start[0] + end[0]) / 2
				points = append(points, Point{midX, start[1]}, Point{midX, end[1]})
			}
		}
		points = append(points, end)

		cls, marker := "a-default", "arrowhead"
		if conn.Variant == "emphasis" {
			cls, marker = "a-emphasis", "arrowhead-emphasis"
		} else if conn.Variant == "security" {
			cls, marker = "a-security", "arrowhead-security"
		} else if conn.Variant == "dashed" {
			cls, marker = "a-dashed", "arrowhead-dashed"
		}
		sw := 1.5
		if conn.Width > 0 {
			sw = conn.Width
		} else if conn.Variant == "emphasis" {
			sw = 1.8
		}

		svg.WriteString(fmt.Sprintf(`<path d="%s" class="%s" stroke-width="%g" marker-end="url(#%s)"/>`,
			roundedPath(points, 8), cls, sw, marker))

		connKey := conn.From + "->" + conn.To
		connCache[connKey] = points

		// Connection label
		if conn.Label != "" {
			lp := labelPoint(&conn, points)
			w := 30.0
			if len(conn.Label)*6 > 30 {
				w = float64(len(conn.Label)*6 + 10)
			}
			svg.WriteString(fmt.Sprintf(`<rect x="%g" y="%g" width="%g" height="14" rx="3" class="c-mask"/>`,
				lp[0]-w/2, lp[1]-10, w))
			accent := "t-muted"
			if conn.Variant == "security" {
				accent = "t-security"
			} else if conn.Variant == "emphasis" {
				accent = "t-backend"
			}
			svg.WriteString(fmt.Sprintf(`<text x="%g" y="%g" class="%s" font-size="8" text-anchor="middle">%s</text>`,
				lp[0], lp[1], accent, esc(conn.Label)))
		}
	}

	// Components
	typeLabels := map[string]string{
		"frontend": "Frontend", "backend": "Backend", "database": "Database",
		"cloud": "Cloud", "security": "Security", "messagebus": "Message bus", "external": "External",
	}
	for _, mc := range compMap {
		fill := "c-external"
		if f, ok := map[string]string{
			"frontend": "c-frontend", "backend": "c-backend", "database": "c-database",
			"cloud": "c-cloud", "security": "c-security", "messagebus": "c-messagebus",
		}[mc.Type]; ok {
			fill = f
		}

		labelY := mc.y + mc.height/2 + 4
		if mc.Sublabel != "" {
			labelY = mc.y + mc.height/2 - 2
		}

		svg.WriteString(fmt.Sprintf(`<rect x="%g" y="%g" width="%g" height="%g" rx="6" class="c-mask"/>`,
			mc.x, mc.y, mc.width, mc.height))
		svg.WriteString(fmt.Sprintf(`<rect x="%g" y="%g" width="%g" height="%g" rx="6" class="%s" stroke-width="1.5"/>`,
			mc.x, mc.y, mc.width, mc.height, fill))
		svg.WriteString(fmt.Sprintf(`<text x="%g" y="%g" class="t-primary" font-size="11" font-weight="600" text-anchor="middle">%s</text>`,
			mc.cx, labelY, esc(mc.Label)))

		if mc.Sublabel != "" {
			svg.WriteString(fmt.Sprintf(`<text x="%g" y="%g" class="t-muted" font-size="9" text-anchor="middle">%s</text>`,
				mc.cx, mc.y+mc.height/2+14, esc(mc.Sublabel)))
		}
		if mc.Tag != "" {
			svg.WriteString(fmt.Sprintf(`<text x="%g" y="%g" class="t-muted" font-size="7" text-anchor="middle">%s</text>`,
				mc.cx, mc.y+mc.height-8, esc(mc.Tag)))
		}
	}

	// Legend
	legendY := vbH - 16
	used := make(map[string]bool)
	legX := margin
	svg.WriteString(fmt.Sprintf(`<text x="%g" y="%g" class="t-primary" font-size="9" font-weight="600">Legend</text>`,
		legX, legendY-13))
	for _, mc := range compMap {
		if used[mc.Type] {
			continue
		}
		used[mc.Type] = true
		fill := "c-external"
		if f, ok := map[string]string{
			"frontend": "c-frontend", "backend": "c-backend", "database": "c-database",
			"cloud": "c-cloud", "security": "c-security", "messagebus": "c-messagebus",
		}[mc.Type]; ok {
			fill = f
		}
		label := typeLabels[mc.Type]
		if label == "" {
			label = mc.Type
		}
		svg.WriteString(fmt.Sprintf(`<rect x="%g" y="%g" width="14" height="9" rx="2" class="%s" stroke-width="1"/>`,
			legX, legendY-8, fill))
		svg.WriteString(fmt.Sprintf(`<text x="%g" y="%g" class="t-muted" font-size="8">%s</text>`,
			legX+20, legendY, esc(label)))
		legX += 30 + len(label)*5 + 28
	}

	svg.WriteString(`</svg>`)
	return svg.String()
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

// --- Workflow renderer (simplified) ---

func renderWorkflow(d *Diagram) string {
	var svg strings.Builder
	svg.WriteString(`<svg viewBox="0 0 800 600" role="img">`)
	svg.WriteString(renderDefs())

	// Compute viewBox from steps
	maxX, maxY := 800.0, 600.0
	for _, s := range asArray(d.Steps) {
		if s.Pos[0]+200 > maxX {
			maxX = s.Pos[0] + 200
		}
		if s.Pos[1]+80 > maxY {
			maxY = s.Pos[1] + 80
		}
	}
	svg.Reset()
	svg.WriteString(fmt.Sprintf(`<svg viewBox="0 0 %g %g" role="img">`, maxX+40, maxY+40))
	svg.WriteString(renderDefs())

	stepMap := make(map[string]Step)
	for _, s := range asArray(d.Steps) {
		stepMap[s.ID] = s
	}

	// Render transitions as arrows
	for _, t := range asArray(d.Transitions) {
		from, ok1 := stepMap[t.From]
		to, ok2 := stepMap[t.To]
		if !ok1 || !ok2 {
			continue
		}
		points := []Point{
			{from.Pos[0] + 80, from.Pos[1] + 30},
			{(from.Pos[0] + 80 + to.Pos[0] + 80) / 2, from.Pos[1] + 30},
			{(from.Pos[0] + 80 + to.Pos[0] + 80) / 2, to.Pos[1] + 30},
			{to.Pos[0], to.Pos[1] + 30},
		}
		svg.WriteString(fmt.Sprintf(`<path d="%s" class="a-default" stroke-width="1.5" marker-end="url(#arrowhead)"/>`,
			roundedPath(points, 8)))
		if t.Label != "" {
			lp := labelPoint(&Connection{LabelDx: 0, LabelDy: 0}, points)
			svg.WriteString(fmt.Sprintf(`<text x="%g" y="%g" class="t-muted" font-size="9" text-anchor="middle">%s</text>`,
				lp[0], lp[1], esc(t.Label)))
		}
	}

	// Render steps
	for _, s := range asArray(d.Steps) {
		cls := "c-backend"
		if s.Type == "start" || s.Type == "end" {
			cls = "c-frontend"
		} else if s.Type == "decision" {
			cls = "c-database"
		}
		rx := 6.0
		if s.Shape == "diamond" {
			rx = 0
		}
		svg.WriteString(fmt.Sprintf(`<rect x="%g" y="%g" width="160" height="60" rx="%g" class="%s" stroke-width="1.5"/>`,
			s.Pos[0], s.Pos[1], rx, cls))
		svg.WriteString(fmt.Sprintf(`<text x="%g" y="%g" class="t-primary" font-size="11" font-weight="600" text-anchor="middle">%s</text>`,
			s.Pos[0]+80, s.Pos[1]+34, esc(s.Label)))
	}

	svg.WriteString(`</svg>`)
	return svg.String()
}

// --- Sequence renderer (simplified) ---

func renderSequence(d *Diagram) string {
	var svg strings.Builder

	// Compute viewBox
	maxX := 600.0
	for _, p := range asArray(d.Participants) {
		if p.Pos[0]+100 > maxX {
			maxX = p.Pos[0] + 100
		}
	}

	partMap := make(map[string]SequenceParticipant)
	for _, p := range asArray(d.Participants) {
		partMap[p.ID] = p
	}

	y := 80.0
	stepY := 60.0

	svg.WriteString(fmt.Sprintf(`<svg viewBox="0 0 %g %g" role="img">`, maxX+100, float64(len(d.Messages)*60)+200))
	svg.WriteString(renderDefs())

	// Lifelines
	for _, p := range asArray(d.Participants) {
		svg.WriteString(fmt.Sprintf(`<line x1="%g" y1="60" x2="%g" y2="%g" class="c-grid" stroke-width="1" stroke-dasharray="4"/>`,
			p.Pos[0]+50, p.Pos[0]+50, float64(len(d.Messages)*60)+200))
		svg.WriteString(fmt.Sprintf(`<rect x="%g" y="20" width="100" height="40" rx="6" class="c-backend"/>`,
			p.Pos[0]))
		svg.WriteString(fmt.Sprintf(`<text x="%g" y="44" class="t-primary" font-size="10" font-weight="600" text-anchor="middle">%s</text>`,
			p.Pos[0]+50, esc(p.Label)))
	}

	// Messages
	for _, m := range asArray(d.Messages) {
		from, ok1 := partMap[m.From]
		to, ok2 := partMap[m.To]
		if !ok1 || !ok2 {
			continue
		}
		y += stepY
		x1, x2 := from.Pos[0]+50, to.Pos[0]+50
		cls := "a-default"
		if m.Type == "async" {
			cls = "a-dashed"
		} else if m.Type == "return" {
			cls = "a-emphasis"
		}
		svg.WriteString(fmt.Sprintf(`<line x1="%g" y1="%g" x2="%g" y2="%g" class="%s" stroke-width="1.5" marker-end="url(#arrowhead)"/>`,
			x1, y, x2, y, cls))
		midX := (x1 + x2) / 2
		svg.WriteString(fmt.Sprintf(`<text x="%g" y="%g" class="t-muted" font-size="9" text-anchor="middle">%s</text>`,
			midX, y-8, esc(m.Label)))
	}

	svg.WriteString(`</svg>`)
	return svg.String()
}

// --- Dataflow renderer (simplified) ---

func renderDataflow(d *Diagram) string {
	var svg strings.Builder
	maxX, maxY := 800.0, 600.0
	for _, n := range asArray(d.Nodes) {
		if n.Pos[0]+200 > maxX {
			maxX = n.Pos[0] + 200
		}
		if n.Pos[1]+80 > maxY {
			maxY = n.Pos[1] + 80
		}
	}

	svg.WriteString(fmt.Sprintf(`<svg viewBox="0 0 %g %g" role="img">`, maxX+40, maxY+40))
	svg.WriteString(renderDefs())

	nodeMap := make(map[string]FlowNode)
	for _, n := range asArray(d.Nodes) {
		nodeMap[n.ID] = n
	}

	// Edges
	for _, e := range asArray(d.Edges) {
		from, ok1 := nodeMap[e.From]
		to, ok2 := nodeMap[e.To]
		if !ok1 || !ok2 {
			continue
		}
		points := []Point{
			{from.Pos[0] + 80, from.Pos[1] + 30},
			{(from.Pos[0] + 80 + to.Pos[0] + 80) / 2, (from.Pos[1] + 30 + to.Pos[1] + 30) / 2},
			{to.Pos[0], to.Pos[1] + 30},
		}
		svg.WriteString(fmt.Sprintf(`<path d="%s" class="a-default" stroke-width="1.5" marker-end="url(#arrowhead)"/>`,
			roundedPath(points, 8)))
		if e.Label != "" {
			lp := labelPoint(&Connection{LabelDx: 0, LabelDy: 0}, points)
			svg.WriteString(fmt.Sprintf(`<text x="%g" y="%g" class="t-muted" font-size="9" text-anchor="middle">%s</text>`,
				lp[0], lp[1], esc(e.Label)))
		}
	}

	// Nodes
	for _, n := range asArray(d.Nodes) {
		cls := "c-backend"
		if n.Type == "source" {
			cls = "c-frontend"
		} else if n.Type == "store" {
			cls = "c-database"
		} else if n.Type == "sink" {
			cls = "c-external"
		}
		svg.WriteString(fmt.Sprintf(`<rect x="%g" y="%g" width="160" height="60" rx="6" class="%s" stroke-width="1.5"/>`,
			n.Pos[0], n.Pos[1], cls))
		svg.WriteString(fmt.Sprintf(`<text x="%g" y="%g" class="t-primary" font-size="11" font-weight="600" text-anchor="middle">%s</text>`,
			n.Pos[0]+80, n.Pos[1]+34, esc(n.Label)))
	}

	svg.WriteString(`</svg>`)
	return svg.String()
}

// --- Lifecycle renderer (simplified) ---

func renderLifecycle(d *Diagram) string {
	// Lifecycle is essentially a workflow with different styling
	return renderWorkflow(d)
}

// --- Shared SVG defs ---

func renderDefs() string {
	return `<defs>
<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" class="m-default"/></marker>
<marker id="arrowhead-emphasis" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" class="m-emphasis"/></marker>
<marker id="arrowhead-security" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" class="m-security"/></marker>
<marker id="arrowhead-dashed" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" class="m-dashed"/></marker>
<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" class="c-grid" stroke-width="0.5"/></pattern>
</defs>`
}

func renderCards(cards []Card) string {
	if len(cards) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString(`<div class="cards">`)
	for _, card := range cards {
		b.WriteString(`<div class="card"><div class="card-header"><div class="card-dot `)
		b.WriteString(esc(card.Dot))
		b.WriteString(`"></div><h3>`)
		b.WriteString(esc(card.Title))
		b.WriteString(`</h3></div><ul>`)
		for _, item := range card.Items {
			b.WriteString(`<li>&bull; `)
			b.WriteString(esc(item))
			b.WriteString(`</li>`)
		}
		b.WriteString(`</ul></div>`)
	}
	b.WriteString(`</div>`)
	return b.String()
}

// --- HTML template ---

func applyTemplate(meta Meta, svg, cards, diagType string) string {
	title := esc(meta.Title)
	subtitle := esc(meta.Subtitle)
	footer := fmt.Sprintf("%s diagram &bull; Built with Spectre", strings.Title(string(diagType)))

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>` + title + ` Diagram</title>
<style>
:root{--bg:#0f1117;--fg:#e5e5e5;--card:#1a1d27;--border:#2a2d3a;--grid:#1a1d27;--c-frontend:#22c55e22;--c-backend:#3b82f622;--c-database:#eab30822;--c-cloud:#a855f722;--c-security:#ef444422;--c-messagebus:#f9731622;--c-external:#6b728022;--t-primary:#e5e5e5;--t-muted:#9ca3af;--t-frontend:#22c55e;--t-backend:#3b82f6;--t-database:#eab308;--t-cloud:#a855f7;--t-security:#ef4444;--t-messagebus:#f97316;--t-external:#6b7280;--a-default:#9ca3af;--a-emphasis:#3b82f6;--a-security:#ef4444;--a-dashed:#f97316;--m-default:#9ca3af;--m-emphasis:#3b82f6;--m-security:#ef4444;--m-dashed:#f97316;--mask:#0f1117cc}
[data-theme=light]{--bg:#ffffff;--fg:#1f2937;--card:#f3f4f6;--border:#e5e7eb;--grid:#f3f4f6;--c-frontend:#22c55e18;--c-backend:#3b82f618;--c-database:#eab30818;--c-cloud:#a855f718;--c-security:#ef444418;--c-messagebus:#f9731618;--c-external:#6b728018;--t-primary:#1f2937;--t-muted:#6b7280;--mask:#ffffffcc}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column;align-items:center;padding:2rem;min-height:100vh}
h1{font-size:1.8rem;font-weight:700;margin-bottom:.25rem}
.subtitle{color:var(--t-muted);font-size:.9rem;margin-bottom:1.5rem}
svg{max-width:100%;height:auto;background:transparent}
.c-mask{fill:var(--mask)}
.c-grid{stroke:var(--grid);fill:none}
.c-region{fill:var(--bg);stroke:var(--border)}
.c-security-group{fill:none;stroke:var(--t-security);stroke-dasharray:6 3}
.c-frontend{fill:var(--c-frontend);stroke:var(--t-frontend)}
.c-backend{fill:var(--c-backend);stroke:var(--t-backend)}
.c-database{fill:var(--c-database);stroke:var(--t-database)}
.c-cloud{fill:var(--c-cloud);stroke:var(--t-cloud)}
.c-security{fill:var(--c-security);stroke:var(--t-security)}
.c-messagebus{fill:var(--c-messagebus);stroke:var(--t-messagebus)}
.c-external{fill:var(--c-external);stroke:var(--t-external)}
.t-primary{fill:var(--t-primary)}
.t-muted{fill:var(--t-muted)}
.t-frontend{fill:var(--t-frontend)}
.t-backend{fill:var(--t-backend)}
.t-database{fill:var(--t-database)}
.t-cloud{fill:var(--t-cloud)}
.t-security{fill:var(--t-security)}
.t-messagebus{fill:var(--t-messagebus)}
.t-external{fill:var(--t-external)}
.a-default{fill:none;stroke:var(--a-default)}
.a-emphasis{fill:none;stroke:var(--a-emphasis)}
.a-security{fill:none;stroke:var(--a-security)}
.a-dashed{fill:none;stroke:var(--a-dashed);stroke-dasharray:6 3}
.m-default{fill:var(--m-default)}
.m-emphasis{fill:var(--m-emphasis)}
.m-security{fill:var(--m-security)}
.m-dashed{fill:var(--m-dashed)}
.cards{display:flex;gap:1rem;flex-wrap:wrap;margin-top:1.5rem;max-width:800px;width:100%}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1rem;flex:1;min-width:200px}
.card-header{display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem}
.card-dot{width:10px;height:10px;border-radius:50%}
.card-dot.cyan{background:#06b6d4}.card-dot.emerald{background:#10b981}.card-dot.violet{background:#8b5cf6}.card-dot.amber{background:#f59e0b}.card-dot.rose{background:#f43f5e}.card-dot.orange{background:#f97316}.card-dot.slate{background:#64748b}
.card h3{font-size:.85rem;font-weight:600}
.card ul{list-style:none;font-size:.75rem;color:var(--t-muted)}
.card li{margin:.15rem 0}
.footer{margin-top:1.5rem;font-size:.75rem;color:var(--t-muted)}
.toolbar{position:fixed;top:1rem;right:1rem;display:flex;gap:.5rem;z-index:10}
.toolbar button{background:var(--card);border:1px solid var(--border);color:var(--fg);padding:.4rem .8rem;border-radius:8px;cursor:pointer;font-size:.75rem}
.toolbar button:hover{border-color:var(--t-backend)}
@media print{.toolbar{display:none}body{padding:0}}
</style>
</head>
<body>
<h1>` + title + `</h1>
<p class="subtitle">` + subtitle + `</p>
<div class="toolbar">
<button onclick="toggleTheme()" title="Toggle theme (T)">T</button>
<button onclick="exportMenu()" title="Export (E)">E</button>
</div>
` + svg + cards + `
<p class="footer">` + footer + `</p>
<script>
function toggleTheme(){const t=document.documentElement.getAttribute("data-theme");document.documentElement.setAttribute("data-theme",t==="light"?"dark":"light")}
document.addEventListener("keydown",e=>{if(e.key==="t"||e.key==="T")toggleTheme();if(e.key==="e"||e.key==="E")exportMenu()});
function exportMenu(){const svg=document.querySelector("svg");if(!svg)return;const s=new XMLSerializer().serializeToString(svg);const blob=new Blob([s],{type:"image/svg+xml"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="diagram.svg";a.click();URL.revokeObjectURL(url)}
</script>
</body>
</html>`
}
