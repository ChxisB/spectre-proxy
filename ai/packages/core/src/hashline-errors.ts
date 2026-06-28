/**
 * Hashline error recovery — builds error responses when hashline
 * verification fails in strict mode.
 */
import { formatHashedLine, hashLine, parseHashedLine } from "./hashline"

/**
 * Extract LINE#ID references from hashed line prefixes in text.
 * Handles both old (LINE:#HASH) and new (LINE#HASH|) formats.
 * Only extracts from lines that start with a hashed prefix.
 */
export function extractLineRefs(text: string): Array<{ line: number; hash: string }> {
  const refs: Array<{ line: number; hash: string }> = []
  for (const line of text.split("\n")) {
    const parsed = parseHashedLine(line)
    if (parsed) {
      refs.push({ line: parsed.lineNumber, hash: parsed.hash })
    }
  }
  return refs
}

/**
 * Verify all line references in an edit request against current file content.
 * Returns validation result with mismatches and file lines.
 */
export function verifyEditRequest(
  filePath: string,
  oldString: string,
  fileContent: string,
): {
  valid: boolean
  mismatches: Array<{ line: number; expected: string; actual: string }>
  fileLines: string[]
} {
  const fileLines = fileContent.split("\n")
  const refs = extractLineRefs(oldString)
  const mismatches: Array<{ line: number; expected: string; actual: string }> = []

  for (const ref of refs) {
    const lineIndex = ref.line - 1
    if (lineIndex < 0 || lineIndex >= fileLines.length) {
      mismatches.push({ line: ref.line, expected: ref.hash, actual: "" })
      continue
    }
    const currentContent = fileLines[lineIndex]
    const actualHash = hashLine(currentContent)
    if (ref.hash !== actualHash) {
      mismatches.push({ line: ref.line, expected: ref.hash, actual: actualHash })
    }
  }

  return {
    valid: mismatches.length === 0,
    mismatches,
    fileLines,
  }
}

/**
 * Build a formatted error response when hashline verification fails.
 * Returns:
 * - error: Human-readable error with >>> markers for model self-correction
 * - remappedContent: File content with corrected hashes (new format)
 */
export function buildHashlineErrorResponse(
  filePath: string,
  mismatches: Array<{ line: number; expected: string; actual: string }>,
  fileContent: string[],
): {
  error: string
  remappedContent: string
} {
  const errorLines: string[] = [`Hash mismatch in ${filePath}:`]
  for (const m of mismatches) {
    const content = fileContent[m.line - 1] ?? ""
    errorLines.push(
      `  Line ${m.line}: expected ${m.line}#${m.expected}, got ${m.line}#${m.actual}`,
    )
    errorLines.push(`  >>> ${m.line}#${m.actual}|${content}`)
  }

  const remappedContent = fileContent
    .map((line, i) => formatHashedLine(i + 1, line))
    .join("\n")

  return {
    error: errorLines.join("\n"),
    remappedContent,
  }
}
