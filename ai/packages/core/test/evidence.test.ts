import { describe, expect, it } from "bun:test"
import { Schema } from "effect"
import { EvidenceSchema } from "@talon-ai/core/evidence/schema"
import { generateEvidenceDirName, writeEvidenceFile, listEvidence, getEvidence } from "@talon-ai/core/evidence/manager"
import { verifyEvidenceGate, formatEvidenceStatus } from "@talon-ai/core/evidence/verifier"
import { EvidenceTool } from "@talon-ai/core/tool/evidence"
import fs from "fs"
import path from "path"
import os from "os"

const nowMillis = Date.now()

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "evidence-test-"))

describe("EvidenceSchema", () => {
  it("parses a valid ScenarioResult", () => {
    const decode = Schema.decodeUnknownSync(EvidenceSchema.ScenarioResult)
    const result = decode({
      name: "happy-path-login",
      category: "happy",
      passCondition: "User can log in with valid credentials",
      status: "pass",
      assertionMessage: "Login returned 200 with token in response body",
      surfaceArtifact: 'curl -X POST /login -d \'{"user":"test","pass":"valid"}\'',
      capturedAt: nowMillis,
    })
    expect(result.name).toBe("happy-path-login")
    expect(result.category).toBe("happy")
    expect(result.status).toBe("pass")
  })

  it("rejects invalid scenario status", () => {
    const decode = Schema.decodeUnknownSync(EvidenceSchema.ScenarioResult)
    expect(() =>
      decode({
        name: "bad-status",
        category: "happy",
        passCondition: "test",
        status: "invalid_status",
        assertionMessage: "test",
        capturedAt: nowMillis,
      }),
    ).toThrow()
  })

  it("all scenario statuses validate correctly", () => {
    const decode = Schema.decodeUnknownSync(EvidenceSchema.ScenarioResult)
    const statuses = ["pass", "fail", "pending", "blocked"] as const
    for (const status of statuses) {
      const result = decode({
        name: `test-${status}`,
        category: "happy",
        passCondition: "test",
        status,
        assertionMessage: "test",
        capturedAt: nowMillis,
      })
      expect(result.status).toBe(status)
    }
  })

  it("parses a valid EvidenceEntry schema", () => {
    const decode = Schema.decodeUnknownSync(EvidenceSchema.EvidenceEntry)
    const result = decode({
      id: "20260627-auth-system-refactor",
      sessionID: "ses_test",
      title: "Auth system refactor",
      goal: "Refactor the auth system to use JWT",
      scenarios: [
        {
          name: "happy-path-login",
          category: "happy",
          passCondition: "User can log in",
          status: "pass",
          assertionMessage: "Passed",
          capturedAt: nowMillis,
        },
      ],
      totalScenarios: 1,
      passedScenarios: 1,
      failedScenarios: 0,
      filesChanged: ["src/auth.ts", "src/login.ts"],
      createdAt: nowMillis,
      completedAt: nowMillis,
    })
    expect(result.id).toBe("20260627-auth-system-refactor")
    expect(result.totalScenarios).toBe(1)
    expect(result.passedScenarios).toBe(1)
  })

  it("empty scenarios array is valid (session in progress)", () => {
    const decode = Schema.decodeUnknownSync(EvidenceSchema.EvidenceEntry)
    const result = decode({
      id: "test-empty",
      sessionID: "ses_test",
      title: "In-progress session",
      goal: "Working on feature",
      scenarios: [],
      totalScenarios: 0,
      passedScenarios: 0,
      failedScenarios: 0,
      createdAt: nowMillis,
    })
    expect(result.scenarios).toEqual([])
    expect(result.totalScenarios).toBe(0)
  })
})

describe("generateEvidenceDirName", () => {
  it("produces correct directory names", () => {
    const name = generateEvidenceDirName("Auth system refactor")
    expect(name).toMatch(/^\d{8}-auth-system-refactor$/)
  })

  it("handles special characters", () => {
    const name = generateEvidenceDirName("Fix: the BUG (urgent!)")
    expect(name).toMatch(/^\d{8}-fix-the-bug-urgent$/)
  })

  it("truncates long titles", () => {
    const long = "a".repeat(200)
    const name = generateEvidenceDirName(long)
    expect(name.length).toBeLessThan(80)
  })
})

describe("writeEvidenceFile and readEvidence", () => {
  it("writes and reads evidence correctly", async () => {
    const dir = tmpDir()
    const dirName = generateEvidenceDirName("Test write")
    const entry = {
      id: dirName,
      sessionID: "ses_test",
      title: "Test write",
      goal: "Testing evidence writing",
      scenarios: [],
      totalScenarios: 0,
      passedScenarios: 0,
      failedScenarios: 0,
      createdAt: nowMillis,
      completedAt: nowMillis,
    }
    const filePath = await writeEvidenceFile(dir, dirName, entry as any)
    expect(fs.existsSync(filePath)).toBe(true)

    const read = await getEvidence(dir, dirName)
    expect(read).toBeDefined()
    expect(read!.title).toBe("Test write")
    expect(read!.id).toBe(dirName)

    const entries = await listEvidence(dir)
    expect(entries.length).toBeGreaterThanOrEqual(1)
    expect(entries[0].title).toBe("Test write")

    const talonDir = path.join(dir, ".talon")
    if (fs.existsSync(talonDir)) {
      fs.rmSync(talonDir, { recursive: true, force: true })
    }
    fs.rmdirSync(dir)
  })
})

describe("verifyEvidenceGate", () => {
  it("passes in warn mode without evidence", async () => {
    const dir = tmpDir()
    const result = await verifyEvidenceGate(dir, { mode: "warn" })
    expect(result.passed).toBe(true)
    expect(result.hasEvidence).toBe(false)
    fs.rmdirSync(dir)
  })

  it("fails in block mode without evidence", async () => {
    const dir = tmpDir()
    const result = await verifyEvidenceGate(dir, { mode: "block" })
    expect(result.passed).toBe(false)
    expect(result.hasEvidence).toBe(false)
    expect(result.failures.length).toBeGreaterThan(0)
    fs.rmdirSync(dir)
  })

  it("passes in block mode with recent evidence", async () => {
    const dir = tmpDir()
    const dirName = generateEvidenceDirName("Recent test")
    const entry = {
      id: dirName,
      sessionID: "ses_test",
      title: "Recent test",
      goal: "Testing recent evidence",
      scenarios: [{ name: "t1", category: "happy", passCondition: "test", status: "pass", assertionMessage: "ok", capturedAt: nowMillis }],
      totalScenarios: 1,
      passedScenarios: 1,
      failedScenarios: 0,
      createdAt: nowMillis,
      completedAt: nowMillis,
    }
    await writeEvidenceFile(dir, dirName, entry as any)
    const result = await verifyEvidenceGate(dir, { mode: "block" })
    expect(result.passed).toBe(true)
    expect(result.hasEvidence).toBe(true)

    const talonDir = path.join(dir, ".talon")
    if (fs.existsSync(talonDir)) {
      fs.rmSync(talonDir, { recursive: true, force: true })
    }
    fs.rmdirSync(dir)
  })
})

describe("formatEvidenceStatus", () => {
  it("produces readable output for passed gate", () => {
    const output = formatEvidenceStatus({
      passed: true,
      hasEvidence: true,
      recentEvidence: [],
      failures: [],
    })
    expect(output).toContain("PASSED")
    expect(output).toContain("warn")
  })

  it("produces readable output for blocked gate", () => {
    const output = formatEvidenceStatus({
      passed: false,
      hasEvidence: false,
      recentEvidence: [],
      failures: ["No evidence found in .talon/evidence/"],
    })
    expect(output).toContain("BLOCKED")
    expect(output).toContain("No evidence found")
  })
})

describe("EvidenceTool schemas", () => {
  it("validates save action input", () => {
    const decode = Schema.decodeUnknownSync(EvidenceTool.Input)
    const result = decode({
      action: "save",
      title: "Test save",
      goal: "Testing evidence save",
      scenarios: [{ name: "t1", category: "happy", passCondition: "test", status: "pass", assertionMessage: "ok" }],
      filesChanged: ["src/test.ts"],
    })
    expect(result.action).toBe("save")
    expect(result.title).toBe("Test save")
    expect(result.scenarios).toHaveLength(1)
  })

  it("validates list action input", () => {
    const decode = Schema.decodeUnknownSync(EvidenceTool.Input)
    const result = decode({ action: "list" })
    expect(result.action).toBe("list")
  })

  it("rejects invalid action", () => {
    const decode = Schema.decodeUnknownSync(EvidenceTool.Input)
    expect(() => decode({ action: "invalid" })).toThrow()
  })

  it("validates output schema", () => {
    const decode = Schema.decodeUnknownSync(EvidenceTool.Output)
    const result = decode({ success: true, path: "/tmp/test.json", summary: "Saved 1 scenario" })
    expect(result.success).toBe(true)
    expect(result.path).toBe("/tmp/test.json")
  })

  it("validates error output", () => {
    const decode = Schema.decodeUnknownSync(EvidenceTool.Output)
    const result = decode({ success: false, error: "Missing title" })
    expect(result.success).toBe(false)
    expect(result.error).toBe("Missing title")
  })
})
