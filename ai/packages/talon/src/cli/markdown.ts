import { Lexer, type Token, type Tokens } from "marked"
import { EOL } from "os"

// ── ANSI escape sequences ──────────────────────────────────────────────
const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"
const DIM = "\x1b[2m"
const ITALIC = "\x1b[3m"
const UNDERLINE = "\x1b[4m"
const STRIKETHROUGH = "\x1b[9m"

const FG_CYAN = "\x1b[96m"
const FG_GREEN = "\x1b[92m"
const FG_YELLOW = "\x1b[93m"
const FG_BLUE = "\x1b[94m"
const FG_GRAY = "\x1b[90m"

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Render markdown text to ANSI-styled terminal output.
 * Falls back to plain text on parse failure.
 */
export function renderMarkdown(text: string): string {
  if (!text) return text

  try {
    const tokens = Lexer.lex(text, { gfm: true })
    return renderBlocks(tokens)
  } catch {
    return text
  }
}

// ── Block-level rendering ─────────────────────────────────────────────

function renderBlocks(tokens: Token[]): string {
  const parts: string[] = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const next = i + 1 < tokens.length ? tokens[i + 1] : undefined
    parts.push(renderBlock(token, next))
  }

  return parts.join("")
}

function renderBlock(token: Token, next?: Token): string {
  switch (token.type) {
    case "heading":
      return renderHeading(token as Tokens.Heading)
    case "paragraph":
      return renderParagraph(token as Tokens.Paragraph)
    case "code":
      return renderCodeBlock(token as Tokens.Code)
    case "blockquote":
      return renderBlockquote(token as Tokens.Blockquote)
    case "list":
      return renderList(token as Tokens.List)
    case "hr":
      return renderHr()
    case "table":
      return renderTable(token as Tokens.Table)
    case "space":
      return spaceBetween(next) ? EOL : ""
    case "text":
      return tokenToText(token)
    default:
      return ""
  }
}

function spaceBetween(next?: Token): boolean {
  return next !== undefined && next.type !== "space"
}

function hasTokens(t: unknown): t is { tokens: Token[] } {
  return (
    typeof t === "object" &&
    t !== null &&
    "tokens" in t &&
    Array.isArray((t as { tokens: unknown }).tokens)
  )
}

function hasText(t: unknown): t is { text: string } {
  return (
    typeof t === "object" &&
    t !== null &&
    "text" in t &&
    typeof (t as { text: unknown }).text === "string"
  )
}

function tokenToText(token: Token): string {
  if (hasTokens(token)) return renderInline(token.tokens)
  if (hasText(token)) return token.text
  return ""
}

// ── Block renderers ────────────────────────────────────────────────────

function renderHeading(token: Tokens.Heading): string {
  const prefix = FG_GRAY + "#".repeat(token.depth) + RESET + " "
  const content = renderInline(token.tokens)
  const style = token.depth <= 2 ? BOLD + FG_CYAN : FG_CYAN
  return prefix + style + content + RESET + EOL.repeat(2)
}

function renderParagraph(token: Tokens.Paragraph): string {
  return renderInline(token.tokens) + EOL.repeat(2)
}

function renderCodeBlock(token: Tokens.Code): string {
  const lines = token.text.split("\n")
  const rendered = lines
    .map((line: string) => "  " + FG_GREEN + line + RESET)
    .join(EOL)
  return rendered + EOL.repeat(2)
}

function renderBlockquote(token: Tokens.Blockquote): string {
  const content = renderInline(token.tokens)
  const lines = content.split("\n")
  const rendered = lines
    .map((line: string) => FG_YELLOW + "│ " + line + RESET)
    .join(EOL)
  return rendered + EOL.repeat(2)
}

function renderList(token: Tokens.List): string {
  const parts: string[] = []
  for (let i = 0; i < token.items.length; i++) {
    const item = token.items[i]
    const ordered = token.ordered
    const marker = ordered
      ? FG_BLUE + String(Number(token.start || 1) + i) + "." + RESET
      : FG_BLUE + "•" + RESET
    const content = renderListItem(item)
    parts.push("  " + marker + " " + content)
  }
  return parts.join(EOL) + EOL.repeat(2)
}

function renderListItem(item: Tokens.ListItem): string {
  const parts: string[] = []

  if (!item.tokens) return ""

  for (const token of item.tokens) {
    switch (token.type) {
      case "text":
      case "paragraph":
        parts.push(renderInline((token as Tokens.Paragraph).tokens))
        break
      case "code":
        parts.push(renderCodeBlock(token as Tokens.Code))
        break
      case "list":
        parts.push(
          renderList(token as Tokens.List)
            .split("\n")
            .map((line: string) => "  " + line)
            .join("\n"),
        )
        break
      case "space":
        break
      default:
        parts.push(tokenToText(token))
        break
    }
  }

  return parts.join(EOL)
}

function renderHr(): string {
  return DIM + "─".repeat(50) + RESET + EOL.repeat(2)
}

function renderTable(token: Tokens.Table): string {
  const parts: string[] = []

  const header = token.header.map((cell: Tokens.TableCell) =>
    renderInline(cell.tokens),
  )
  parts.push("  " + header.join(" │ "))

  const sep = token.header.map((_: Tokens.TableCell, i: number) => {
    const align = token.align[i]
    if (align === "center") return ":─:"
    if (align === "right") return "──:"
    return "───"
  })
  parts.push("  " + sep.join("─┼─"))

  for (const row of token.rows) {
    const cells = row.map((cell: Tokens.TableCell) => renderInline(cell.tokens))
    parts.push("  " + cells.join(" │ "))
  }

  return parts.join(EOL) + EOL.repeat(2)
}

// ── Inline rendering ──────────────────────────────────────────────────

function renderInline(tokens: Token[]): string {
  const parts: string[] = []
  for (const token of tokens) {
    parts.push(renderInlineToken(token))
  }
  return parts.join("")
}

function renderInlineToken(token: Token): string {
  switch (token.type) {
    case "text":
      return token.text

    case "escape":
      return token.text

    case "strong":
      return BOLD + renderInline(token.tokens ?? []) + RESET

    case "em":
      return ITALIC + renderInline(token.tokens ?? []) + RESET

    case "codespan":
      return FG_GREEN + token.text + RESET

    case "del":
      return STRIKETHROUGH + token.text + RESET

    case "link":
      return (
        renderInline(token.tokens ?? []) +
        " " +
        UNDERLINE +
        FG_BLUE +
        token.href +
        RESET
      )

    case "image":
      const alt = token.text || "image"
      return DIM + alt + " " + UNDERLINE + FG_BLUE + token.href + RESET

    case "br":
      return EOL

    case "html":
      return ""

    default:
      return tokenToText(token)
  }
}
