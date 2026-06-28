/**
 * Hashline — content-hash verification for line-level edit safety.
 *
 * Each line of a read file is tagged with a short content hash:
 *   42:#aB3x7Z  const x = 1        (old format — deprecated)
 *   42#aB3x7Z|const x = 1          (new format — default)
 *
 * When the LLM calls edit with a hashed oldString, we verify the file
 * hasn't changed since it was read. If content shifted, the hashes
 * won't match and the edit is safely rejected.
 *
 * Inspired by oh-my-openagent's hashline-core.
 */

// ---------------------------------------------------------------------------
// Hash alphabet — 20 unambiguous characters, no vowels (no accidental words)
// ---------------------------------------------------------------------------

const ALPHABET = "ZPMQVRWSNKTXJBYH"
const HASH_LEN = 6

/**
 * Generate a short content hash for a line of text.
 * Uses a simple 6-char base-18 checksum.
 */
export function hashLine(line: string): string {
  let hash = 0
  for (let i = 0; i < line.length; i++) {
    hash = ((hash << 5) - hash + line.charCodeAt(i)) | 0
  }
  // Convert to a positive base-18 string
  const abs = Math.abs(hash)
  let result = ""
  let remaining = abs
  for (let i = 0; i < HASH_LEN; i++) {
    result = ALPHABET[remaining % ALPHABET.length] + result
    remaining = Math.floor(remaining / ALPHABET.length)
  }
  return result
}

// ---------------------------------------------------------------------------
// Line prefix patterns
// ---------------------------------------------------------------------------

const OLD_HASHLINE_PATTERN = /^(\d+):#?([A-Z]+)\s\s/
const NEW_HASHLINE_PATTERN = /^(\d+)#([A-Z]+)\|/

/**
 * Detect which hashline format a line uses.
 * Returns "old" for LINE:#HASH, "new" for LINE#HASH|, or "none".
 */
export function detectFormat(line: string): "old" | "new" | "none" {
  if (NEW_HASHLINE_PATTERN.test(line)) return "new"
  if (OLD_HASHLINE_PATTERN.test(line)) return "old"
  return "none"
}

/**
 * Format a line number + line content into a hashed line using the new format.
 * Returns "42#aB3x7Z|const x = 1"
 */
export function formatHashedLine(lineNumber: number, content: string): string {
  const hash = hashLine(content)
  return `${lineNumber}#${hash}|${content}`
}

/**
 * Format a line number + line content into a hashed line using the old format.
 * Returns "42:#aB3x7Z  const x = 1"
 */
export function formatHashedLineOld(lineNumber: number, content: string): string {
  const hash = hashLine(content)
  return `${lineNumber}:#${hash}  ${content}`
}

/**
 * Parse a hashed line prefix (handles both old and new formats).
 * Returns { lineNumber, hash, content } or null if the line isn't hashed.
 */
export function parseHashedLine(line: string): { lineNumber: number; hash: string; content: string } | null {
  let match = NEW_HASHLINE_PATTERN.exec(line)
  if (match) {
    return {
      lineNumber: parseInt(match[1], 10),
      hash: match[2],
      content: line.slice(match[0].length),
    }
  }
  match = OLD_HASHLINE_PATTERN.exec(line)
  if (match) {
    return {
      lineNumber: parseInt(match[1], 10),
      hash: match[2],
      content: line.slice(match[0].length),
    }
  }
  return null
}

/**
 * Parse a standalone line reference string like "145#VK".
 * Returns { line, hash } or undefined if the ref is invalid.
 */
export function parseLineRef(ref: string): { line: number; hash: string } | undefined {
  const match = /^(\d+)#([A-Z]+)$/.exec(ref)
  if (!match) return undefined
  return {
    line: parseInt(match[1], 10),
    hash: match[2],
  }
}

/**
 * Strip hashline prefixes from multi-line text.
 * Handles both old ":#HASH  " and new "#HASH|" patterns.
 * Used by the edit tool to strip hashes from oldString before matching.
 */
export function stripHashes(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const parsed = parseHashedLine(line)
      return parsed ? parsed.content : line
    })
    .join("\n")
}

/**
 * Verify that the hashes in oldString match the current file content.
 * Returns { ok, mismatches } where mismatches lists line numbers that differ.
 */
export function verifyHashes(
  oldString: string,
  currentContent: string,
): { ok: boolean; mismatches: number[] } {
  const oldLines = oldString.split("\n")
  const currentLines = currentContent.split("\n")
  const mismatches: number[] = []

  for (let i = 0; i < oldLines.length; i++) {
    const oldLine = oldLines[i]
    const parsed = parseHashedLine(oldLine)
    if (!parsed) continue

    const lineIndex = parsed.lineNumber - 1
    if (lineIndex < 0 || lineIndex >= currentLines.length) {
      mismatches.push(parsed.lineNumber)
      continue
    }

    const currentLine = currentLines[lineIndex]
    const expectedHash = hashLine(currentLine)
    if (parsed.hash !== expectedHash) {
      mismatches.push(parsed.lineNumber)
    }
  }

  return {
    ok: mismatches.length === 0,
    mismatches,
  }
}

/**
 * Error thrown when a hashline verification fails.
 * Contains the file path, line number, expected and actual hashes,
 * and a remap of old hashes to corrected hashes.
 */
export class HashlineMismatchError extends Error {
  readonly filePath: string
  readonly line: number
  readonly expectedHash: string
  readonly actualHash: string
  readonly remaps: Map<string, string>

  constructor(filePath: string, line: number, expected: string, actual: string) {
    super(`Hash mismatch at ${line}#${expected} (expected ${expected}, got ${actual})`)
    this.name = "HashlineMismatchError"
    this.filePath = filePath
    this.line = line
    this.expectedHash = expected
    this.actualHash = actual
    this.remaps = new Map([[expected, actual]])
  }

  formatErrorMessage(content?: string): string {
    const line = content
      ? `>>> ${this.line}#${this.actualHash}|${content}`
      : `    (line content unavailable)`
    return [
      `Hash mismatch at ${this.line}#${this.expectedHash} (expected ${this.expectedHash}, got ${this.actualHash})`,
      line,
    ].join("\n")
  }
}

/**
 * Validate a set of line references against current file content.
 * Returns an array with the validation status for each ref.
 */
export function validateLineRefs(
  refs: Array<{ line: number; hash: string }>,
  content: string[],
): Array<{ line: number; hash: string; valid: boolean; actualHash?: string }> {
  return refs.map((ref) => {
    const lineIndex = ref.line - 1
    if (lineIndex < 0 || lineIndex >= content.length) {
      return { ...ref, valid: false }
    }
    const actual = hashLine(content[lineIndex])
    return {
      ...ref,
      valid: ref.hash === actual,
      actualHash: actual,
    }
  })
}
