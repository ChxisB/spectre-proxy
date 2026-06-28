import { describe, expect, test } from "bun:test"
import {
  hashLine,
  formatHashedLine,
  formatHashedLineOld,
  parseHashedLine,
  parseLineRef,
  detectFormat,
  stripHashes,
  verifyHashes,
  HashlineMismatchError,
  validateLineRefs,
} from "../hashline"
import { extractLineRefs, verifyEditRequest, buildHashlineErrorResponse } from "../hashline-errors"

describe("hashLine", () => {
  test("produces a 6-char hash", () => {
    const h = hashLine("const x = 1")
    expect(h).toHaveLength(6)
  })

  test("same content produces same hash", () => {
    expect(hashLine("hello")).toBe(hashLine("hello"))
  })

  test("different content produces different hash", () => {
    expect(hashLine("hello")).not.toBe(hashLine("world"))
  })

  test("empty string produces consistent hash", () => {
    const h = hashLine("")
    expect(h).toHaveLength(6)
  })

  test("uses only valid alphabet characters", () => {
    const alphabet = "ZPMQVRWSNKTXJBYH"
    const h = hashLine("test")
    for (const c of h) {
      expect(alphabet).toContain(c)
    }
  })
})

describe("formatHashedLine", () => {
  test("produces LINE#HASH|CONTENT format (new default)", () => {
    const result = formatHashedLine(42, "const x = 1")
    expect(result).toMatch(/^\d+#[A-Z]+\|const x = 1$/)
    expect(result).not.toMatch(/^42:#/)
  })

  test("includes correct content after pipe", () => {
    const result = formatHashedLine(1, "hello world")
    expect(result.endsWith("|hello world")).toBe(true)
  })

  test("hash matches hashLine output", () => {
    const content = "test line"
    const result = formatHashedLine(5, content)
    const expectedHash = hashLine(content)
    expect(result).toBe(`5#${expectedHash}|${content}`)
  })
})

describe("formatHashedLineOld", () => {
  test("produces LINE:#HASH  CONTENT format (old)", () => {
    const result = formatHashedLineOld(42, "const x = 1")
    expect(result).toMatch(/^42:#[A-Z]+  const x = 1$/)
    expect(result).toContain(":#")
  })
})

describe("parseHashedLine", () => {
  test("parses new format", () => {
    const result = parseHashedLine("145#VK|const x = 1")
    expect(result).not.toBeNull()
    expect(result!.lineNumber).toBe(145)
    expect(result!.hash).toBe("VK")
    expect(result!.content).toBe("const x = 1")
  })

  test("parses old format (backward compat)", () => {
    const result = parseHashedLine("42:#VK  const x = 1")
    expect(result).not.toBeNull()
    expect(result!.lineNumber).toBe(42)
    expect(result!.hash).toBe("VK")
    expect(result!.content).toBe("const x = 1")
  })

  test("returns null for non-hashed lines", () => {
    expect(parseHashedLine("plain text")).toBeNull()
    expect(parseHashedLine("")).toBeNull()
    expect(parseHashedLine("42  const x = 1")).toBeNull()
  })

  test("handles empty content after pipe", () => {
    const result = parseHashedLine("1#ABC|")
    expect(result).not.toBeNull()
    expect(result!.lineNumber).toBe(1)
    expect(result!.hash).toBe("ABC")
    expect(result!.content).toBe("")
  })
})

describe("parseLineRef", () => {
  test("parses valid LINE#HASH ref", () => {
    const result = parseLineRef("145#VK")
    expect(result).toEqual({ line: 145, hash: "VK" })
  })

  test("returns undefined for invalid refs", () => {
    expect(parseLineRef("145#VK|")).toBeUndefined()
    expect(parseLineRef("abc#VK")).toBeUndefined()
    expect(parseLineRef("145#")).toBeUndefined()
    expect(parseLineRef("")).toBeUndefined()
    expect(parseLineRef("145:VK")).toBeUndefined()
  })
})

describe("detectFormat", () => {
  test("detects new format", () => {
    expect(detectFormat("145#VK|content")).toBe("new")
  })

  test("detects old format", () => {
    expect(detectFormat("145:#VK  content")).toBe("old")
  })

  test("detects none for non-hashed lines", () => {
    expect(detectFormat("plain text")).toBe("none")
    expect(detectFormat("")).toBe("none")
    expect(detectFormat("145:VK content")).toBe("none")
  })
})

describe("stripHashes", () => {
  test("strips new format hashes", () => {
    const input = "145#VK|const x = 1\n146#XJ|const y = 2"
    const expected = "const x = 1\nconst y = 2"
    expect(stripHashes(input)).toBe(expected)
  })

  test("strips old format hashes (backward compat)", () => {
    const input = "145:#VK  const x = 1\n146:#XJ  const y = 2"
    const expected = "const x = 1\nconst y = 2"
    expect(stripHashes(input)).toBe(expected)
  })

  test("handles mixed formats", () => {
    const input = "145#VK|const x = 1\n146:#XJ  const y = 2\nplain line"
    const expected = "const x = 1\nconst y = 2\nplain line"
    expect(stripHashes(input)).toBe(expected)
  })

  test("handles lines without hashes unchanged", () => {
    expect(stripHashes("plain text")).toBe("plain text")
    expect(stripHashes("")).toBe("")
  })

  test("handles content with hash-like strings", () => {
    const input = "1#ABC|contains #hash| in content"
    expect(stripHashes(input)).toBe("contains #hash| in content")
  })
})

describe("verifyHashes", () => {
  test("passes for matching content", () => {
    const content = "line one\nline two"
    const hashedLine1 = formatHashedLine(1, "line one")
    const hashedLine2 = formatHashedLine(2, "line two")
    const oldString = `${hashedLine1}\n${hashedLine2}`
    const result = verifyHashes(oldString, content)
    expect(result.ok).toBe(true)
    expect(result.mismatches).toEqual([])
  })

  test("detects content changes", () => {
    const oldContent = "line one\nline two"
    const newContent = "line one\nmodified line"
    const hashedLine1 = formatHashedLine(1, "line one")
    const hashedLine2 = formatHashedLine(2, "line two")
    const oldString = `${hashedLine1}\n${hashedLine2}`
    const result = verifyHashes(oldString, newContent)
    expect(result.ok).toBe(false)
    expect(result.mismatches).toContain(2)
  })

  test("skips non-hashed lines", () => {
    const oldString = "plain line\n1#ABC|content"
    const currentContent = "plain line\ndifferent content"
    const result = verifyHashes(oldString, currentContent)
    expect(result.ok).toBe(false)
  })
})

describe("HashlineMismatchError", () => {
  test("constructs with correct properties", () => {
    const error = new HashlineMismatchError("/path/file.ts", 42, "ABC", "XYZ")
    expect(error.filePath).toBe("/path/file.ts")
    expect(error.line).toBe(42)
    expect(error.expectedHash).toBe("ABC")
    expect(error.actualHash).toBe("XYZ")
    expect(error.name).toBe("HashlineMismatchError")
  })

  test("remaps contains old -> new mapping", () => {
    const error = new HashlineMismatchError("/path/file.ts", 42, "ABC", "XYZ")
    expect(error.remaps.get("ABC")).toBe("XYZ")
    expect(error.remaps.size).toBe(1)
  })

  test("formatErrorMessage() produces >>> markers", () => {
    const error = new HashlineMismatchError("/path/file.ts", 42, "ABC", "XYZ")
    const msg = error.formatErrorMessage("const x = 1")
    expect(msg).toContain(">>> 42#XYZ|const x = 1")
    expect(msg).toContain("Hash mismatch at 42#ABC")
  })

  test("formatErrorMessage() handles missing content", () => {
    const error = new HashlineMismatchError("/path/file.ts", 42, "ABC", "XYZ")
    const msg = error.formatErrorMessage()
    expect(msg).toContain("(line content unavailable)")
  })
})

describe("validateLineRefs", () => {
  test("validates correct refs", () => {
    const refs = [{ line: 1, hash: hashLine("hello") }]
    const result = validateLineRefs(refs, ["hello"])
    expect(result[0].valid).toBe(true)
    expect(result[0].actualHash).toBe(refs[0].hash)
  })

  test("detects invalid refs", () => {
    const refs = [{ line: 1, hash: hashLine("hello") }]
    const result = validateLineRefs(refs, ["world"])
    expect(result[0].valid).toBe(false)
    expect(result[0].actualHash).toBe(hashLine("world"))
  })

  test("handles out-of-range lines", () => {
    const refs = [{ line: 10, hash: "ABC" }]
    const result = validateLineRefs(refs, ["only one"])
    expect(result[0].valid).toBe(false)
    expect(result[0].actualHash).toBeUndefined()
  })

  test("handles empty refs", () => {
    expect(validateLineRefs([], [])).toEqual([])
  })
})

describe("extractLineRefs", () => {
  test("extracts from new format", () => {
    const text = "145#VK|const x = 1\n146#XJ|const y = 2"
    const refs = extractLineRefs(text)
    expect(refs).toEqual([
      { line: 145, hash: "VK" },
      { line: 146, hash: "XJ" },
    ])
  })

  test("extracts from old format", () => {
    const text = "145:#VK  const x = 1\n146:#XJ  const y = 2"
    const refs = extractLineRefs(text)
    expect(refs).toEqual([
      { line: 145, hash: "VK" },
      { line: 146, hash: "XJ" },
    ])
  })

  test("skips non-hashed lines", () => {
    const text = "plain line\n145#VK|content"
    const refs = extractLineRefs(text)
    expect(refs).toEqual([{ line: 145, hash: "VK" }])
  })

  test("returns empty array for no hashes", () => {
    expect(extractLineRefs("plain text")).toEqual([])
    expect(extractLineRefs("")).toEqual([])
  })
})

describe("verifyEditRequest", () => {
  test("returns valid for matching content", () => {
    const oldString = "1#ABC|hello"
    // Replace hash with actual hash of "hello"
    const actualHash = hashLine("hello")
    const actualOldString = `1#${actualHash}|hello`
    const result = verifyEditRequest("/path/file.ts", actualOldString, "hello")
    expect(result.valid).toBe(true)
    expect(result.mismatches).toEqual([])
  })

  test("detects mismatches", () => {
    const oldString = "1#ABC|hello"
    const result = verifyEditRequest("/path/file.ts", oldString, "world")
    expect(result.valid).toBe(false)
    expect(result.mismatches).toHaveLength(1)
    expect(result.mismatches[0].line).toBe(1)
    expect(result.mismatches[0].expected).toBe("ABC")
    expect(result.mismatches[0].actual).toBe(hashLine("world"))
  })

  test("handles out-of-range line numbers", () => {
    const oldString = "5#ABC|hello"
    const result = verifyEditRequest("/path/file.ts", oldString, "only one")
    expect(result.valid).toBe(false)
    expect(result.mismatches[0].actual).toBe("")
  })

  test("returns fileLines", () => {
    const content = "line1\nline2\nline3"
    const actualHash = hashLine("line2")
    const oldString = `2#${actualHash}|line2`
    const result = verifyEditRequest("/path/file.ts", oldString, content)
    expect(result.fileLines).toEqual(["line1", "line2", "line3"])
  })
})

describe("buildHashlineErrorResponse", () => {
  test("produces error with >>> markers", () => {
    const result = buildHashlineErrorResponse(
      "/path/file.ts",
      [{ line: 1, expected: "ABC", actual: "XYZ" }],
      ["const x = 1"],
    )
    expect(result.error).toContain("Hash mismatch in /path/file.ts")
    expect(result.error).toContain(">>> 1#XYZ|const x = 1")
    expect(result.error).toContain("Line 1: expected 1#ABC, got 1#XYZ")
  })

  test("produces remappedContent with corrected hashes", () => {
    const content = ["const x = 1", "const y = 2"]
    const result = buildHashlineErrorResponse("/path/file.ts", [], content)
    const lines = result.remappedContent.split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(/^1#[A-Z]+\|const x = 1$/)
  })

  test("handles multiple mismatches", () => {
    const result = buildHashlineErrorResponse(
      "/path/file.ts",
      [
        { line: 1, expected: "ABC", actual: "XYZ" },
        { line: 3, expected: "DEF", actual: "UVW" },
      ],
      ["a", "b", "c"],
    )
    expect(result.error).toContain(">>> 1#XYZ|a")
    expect(result.error).toContain(">>> 3#UVW|c")
  })

  test("handles empty mismatches", () => {
    const result = buildHashlineErrorResponse("/path/file.ts", [], ["content"])
    expect(result.error).toBe("Hash mismatch in /path/file.ts:")
  })
})

describe("backward compatibility", () => {
  test("old format lines parse correctly in parseHashedLine", () => {
    const result = parseHashedLine("42:#VK  const x = 1")
    expect(result).not.toBeNull()
    expect(result!.lineNumber).toBe(42)
    expect(result!.hash).toBe("VK")
    expect(result!.content).toBe("const x = 1")
  })

  test("stripHashes handles old format", () => {
    const result = stripHashes("42:#VK  const x = 1\n43:#XJ  const y = 2")
    expect(result).toBe("const x = 1\nconst y = 2")
  })

  test("verifyHashes handles old format", () => {
    const hashedLine1 = formatHashedLineOld(1, "hello")
    const hashedLine2 = formatHashedLineOld(2, "world")
    const oldString = `${hashedLine1}\n${hashedLine2}`
    const result = verifyHashes(oldString, "hello\nworld")
    expect(result.ok).toBe(true)
  })

  test("extractLineRefs handles old format", () => {
    const refs = extractLineRefs("42:#VK  content")
    expect(refs).toEqual([{ line: 42, hash: "VK" }])
  })

  test("parseHashedLine handles buggy old format (without #)", () => {
    const result = parseHashedLine("42:VK  content")
    expect(result).not.toBeNull()
    expect(result!.lineNumber).toBe(42)
    expect(result!.hash).toBe("VK")
    expect(result!.content).toBe("content")
  })

  test("stripHashes handles buggy old format (without #)", () => {
    expect(stripHashes("42:VK  content")).toBe("content")
  })
})
