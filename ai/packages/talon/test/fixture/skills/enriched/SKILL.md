---
name: enriched-test
description: "Test skill with all OMO fields"
model: claude-sonnet-4-6
agent: explore
subtask: true
argument-hint: "test this skill"
license: MIT
compatibility: v1
metadata:
  author: test
  version: "1.0"
allowed-tools:
  - read
  - glob
mcp_servers:
  - name: test-server
    type: stdio
    command: echo
mcp:
  omo-server:
    type: stdio
    command: ["echo", "hello"]
    enabled: true
---
# Enriched Test Skill
Test body.
