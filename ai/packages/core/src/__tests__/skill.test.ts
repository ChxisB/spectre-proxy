import { expect, describe, it } from "bun:test"
import { Schema } from "effect"
import { SkillV2 } from "../skill"

describe("SkillV2.Info enriched schema", () => {
    it("parses all new fields correctly", () => {
        const decode = Schema.decodeUnknownSync(SkillV2.Info)
        const result = decode({
            name: "test-skill",
            description: "A test skill",
            model: "claude-sonnet-4-6",
            agent: "explore",
            subtask: true,
            "argument-hint": "test this skill",
            license: "MIT",
            compatibility: "v1",
            metadata: { author: "test", version: "1.0" },
            "allowed-tools": ["read", "glob"],
            mcp_servers: [
                { name: "test-server", type: "stdio" as const, command: "echo" },
            ],
            location: "/tmp/test/SKILL.md",
            content: "# Test\nBody.",
        })
        expect(result.name).toBe("test-skill")
        expect(result.model).toBe("claude-sonnet-4-6")
        expect(result.agent).toBe("explore")
        expect(result.subtask).toBe(true)
        expect(result["argument-hint"]).toBe("test this skill")
        expect(result.license).toBe("MIT")
        expect(result.compatibility).toBe("v1")
        expect(result.metadata).toEqual({ author: "test", version: "1.0" })
        expect(result["allowed-tools"]).toEqual(["read", "glob"])
        expect(result.mcp_servers).toHaveLength(1)
        expect(result.mcp_servers![0].name).toBe("test-server")
    })

    it("rejects model as a number", () => {
        const decode = Schema.decodeUnknownSync(SkillV2.Info)
        expect(() =>
            decode({
                name: "bad-skill",
                model: 42,
                location: "/tmp/SKILL.md",
                content: "# Bad",
            }),
        ).toThrow()
    })

    it("rejects allowed-tools as a string", () => {
        const decode = Schema.decodeUnknownSync(SkillV2.Info)
        expect(() =>
            decode({
                name: "bad-skill",
                "allowed-tools": "read",
                location: "/tmp/SKILL.md",
                content: "# Bad",
            }),
        ).toThrow()
    })

    it("rejects subtask as a string", () => {
        const decode = Schema.decodeUnknownSync(SkillV2.Info)
        expect(() =>
            decode({
                name: "bad-skill",
                subtask: "true",
                location: "/tmp/SKILL.md",
                content: "# Bad",
            }),
        ).toThrow()
    })

    it("allows missing all new fields (backward compatibility)", () => {
        const decode = Schema.decodeUnknownSync(SkillV2.Info)
        const result = decode({
            name: "minimal-skill",
            location: "/tmp/SKILL.md",
            content: "# Minimal",
        })
        expect(result.name).toBe("minimal-skill")
        expect(result.model).toBeUndefined()
        expect(result.agent).toBeUndefined()
        expect(result.subtask).toBeUndefined()
        expect(result["argument-hint"]).toBeUndefined()
        expect(result.license).toBeUndefined()
        expect(result.compatibility).toBeUndefined()
        expect(result.metadata).toBeUndefined()
        expect(result["allowed-tools"]).toBeUndefined()
        expect(result.mcp_servers).toBeUndefined()
    })

    it("handles argument-hint with bracket notation", () => {
        const decode = Schema.decodeUnknownSync(SkillV2.Info)
        const result = decode({
            name: "hint-skill",
            "argument-hint": "some hint",
            location: "/tmp/SKILL.md",
            content: "# Hint",
        })
        expect(result["argument-hint"]).toBe("some hint")
    })

    it("accepts empty allowed-tools array", () => {
        const decode = Schema.decodeUnknownSync(SkillV2.Info)
        const result = decode({
            name: "empty-tools-skill",
            "allowed-tools": [],
            location: "/tmp/SKILL.md",
            content: "# Empty tools",
        })
        expect(result["allowed-tools"]).toEqual([])
    })

    it("accepts empty metadata object", () => {
        const decode = Schema.decodeUnknownSync(SkillV2.Info)
        const result = decode({
            name: "empty-meta-skill",
            metadata: {},
            location: "/tmp/SKILL.md",
            content: "# Empty meta",
        })
        expect(result.metadata).toEqual({})
    })

    it("rejects metadata with non-string values", () => {
        const decode = Schema.decodeUnknownSync(SkillV2.Info)
        expect(() =>
            decode({
                name: "bad-meta-skill",
                metadata: { count: 42 },
                location: "/tmp/SKILL.md",
                content: "# Bad meta",
            }),
        ).toThrow()
    })
})

describe("SkillV2.Info mcp_servers array format", () => {
    it("accepts mcp_servers with all fields", () => {
        const decode = Schema.decodeUnknownSync(SkillV2.Info)
        const result = decode({
            name: "mcp-skill",
            mcp_servers: [
                {
                    name: "full-server",
                    type: "stdio" as const,
                    command: "npx",
                    args: ["-y", "@my/mcp"],
                    env: { KEY: "value" },
                    enabled: true,
                },
                {
                    name: "remote-server",
                    type: "remote" as const,
                    url: "https://example.com/mcp",
                },
            ],
            location: "/tmp/SKILL.md",
            content: "# MCP",
        })
        expect(result.mcp_servers).toHaveLength(2)
        expect(result.mcp_servers![0].name).toBe("full-server")
        expect(result.mcp_servers![0].type).toBe("stdio")
        expect(result.mcp_servers![0].command).toBe("npx")
        expect(result.mcp_servers![0].args).toEqual(["-y", "@my/mcp"])
        expect(result.mcp_servers![0].env).toEqual({ KEY: "value" })
        expect(result.mcp_servers![0].enabled).toBe(true)
        expect(result.mcp_servers![1].type).toBe("remote")
        expect(result.mcp_servers![1].url).toBe("https://example.com/mcp")
    })

    it("accepts mcp_servers with minimal fields", () => {
        const decode = Schema.decodeUnknownSync(SkillV2.Info)
        const result = decode({
            name: "minimal-mcp-skill",
            mcp_servers: [
                { name: "minimal", type: "stdio" as const },
            ],
            location: "/tmp/SKILL.md",
            content: "# Minimal MCP",
        })
        expect(result.mcp_servers![0].name).toBe("minimal")
        expect(result.mcp_servers![0].type).toBe("stdio")
        expect(result.mcp_servers![0].command).toBeUndefined()
    })
})

describe("SkillV2.Info with frontmatter parsing", () => {
    it("parses frontmatter from markdown content", () => {
        const markdown = `---
name: fm-skill
description: From frontmatter
model: gpt-4
allowed-tools:
  - read
  - write
---
# Skill Body
Content here.`
        const { ConfigMarkdown } = require("../config/markdown")
        const configMarkdown = ConfigMarkdown as { parseOption: (content: string) => { data: Record<string, unknown>; content: string } | undefined }
        const parsed = configMarkdown.parseOption(markdown)
        expect(parsed).toBeDefined()
        const data = parsed!.data
        expect(data.name).toBe("fm-skill")
        expect(data.model).toBe("gpt-4")
        expect(data["allowed-tools"]).toEqual(["read", "write"])
    })
})
