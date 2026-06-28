<!-- Context: core/context-system/guides/rtk | Priority: critical | Version: 1.0 | Updated: 2026-06-28 -->
# RTK (Reference Text Knowledge) Technique

> **Goal**: Reduce token usage by 80%+ using reference-based context loading

---

## What is RTK?

RTK replaces inline verbose content with **compact reference codes**. Agents fetch full content only when needed, using a just-in-time loading pattern.

**Before (verbose):** 3,795 lines of inline standards = ~300K tokens
**After (RTK):** ~72 line reference index + on-demand file loads = ~5K tokens

---

## The RTK Pattern

```
┌──────────────────────────────────────────────┐
│  PROMPT (always loaded — compact)             │
│  ┌──────────────────────────────────────────┐ │
│  │ @ref:code-quality → loads when coding    │ │
│  │ @ref:testing → loads when testing        │ │
│  │ @ref:security → loads for security review│ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
         │
         ▼ (agent encounters @ref:code-quality)
         │
┌──────────────────────────────────────────────┐
│  REFERENCE FILE (loaded on demand)            │
│  context/core/standards/code-quality.md       │
│  (<200 lines, MVI-compliant)                  │
└──────────────────────────────────────────────┘
```

---

## When to Use RTK

| Scenario | RTK? | Why |
|----------|------|-----|
| **Agent system prompt** | ✅ ALWAYS | Keep under 2K tokens |
| **Coding standards** | ✅ ALWAYS | Reference by `@ref:` code |
| **Security patterns** | ✅ ALWAYS | Load only during security review |
| **Context files** | ✅ ALWAYS | MVI format + reference links |
| **Current task context** | ❌ NO | Must be inline for accuracy |
| **Error messages** | ❌ NO | Must be immediate |
| **User instructions** | ❌ NO | Must be verbatim |

---

## Reference Code System

Each reference code maps to a specific file:

| Code | File | When to Load |
|------|------|-------------|
| `@ref:code-quality` | `core/standards/code-quality.md` | Before writing code |
| `@ref:testing` | `core/standards/test-coverage.md` | Before writing tests |
| `@ref:typescript` | `core/standards/typescript.md` | When writing TypeScript |
| `@ref:documentation` | `core/standards/documentation.md` | When writing docs |
| `@ref:security` | `core/standards/security-patterns.md` | During security review |
| `@ref:delegation` | `core/workflows/task-delegation-basics.md` | Before delegating |
| `@ref:code-review` | `core/workflows/code-review.md` | Before reviewing code |

---

## Implementation Steps

### 1. Create Reference Index
A compact file (like this one) that maps `@ref:` codes to file paths.

### 2. Use `@ref:` Codes in Prompts
Instead of embedding full standards, use the reference code:
```
Before: "Follow code-quality.md: use single-word function names..."
After:  "Follow @ref:code-quality when implementing"
```

### 3. Load on Demand
When an agent encounters `@ref:code-quality`, it calls `ContextScout` or reads the referenced file directly.

### 4. Cache Loaded References
Once loaded, cache the content for the session duration using:
```
.tmp/sessions/{session-id}/.cache/{ref-code}.md
```

---

## Cost Impact

| Technique | Reduction | Implementation |
|-----------|-----------|----------------|
| MVI compliance | ~60% | Files <200 lines |
| RTK references | ~80% | Replace inline with refs |
| Context caching | ~40% | Cache repeated loads |
| Lightweight handoff | ~83% | Per-agent minimal context |
| **Combined** | **~90-95%** | All techniques together |

---

## Related

- `guides/compact.md` — File compression techniques
- `standards/mvi.md` — Minimal Viable Information standard
- `workflows/lightweight-context-handoff.md` — Per-agent minimal context
- `workflows/task-delegation-caching.md` — Context caching for delegation
