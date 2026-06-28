<!-- Context: core/standards | Priority: critical | Version: 2.0 | Updated: 2026-06-28 -->
# Codebase Standards — RTK Reference

> **RTK mode**: This file is a reference index. Full standards are loaded on demand via `@ref:` codes below.

---

## Core Conventions (TL;DR)

| Area | Standard | Reference Code |
|------|----------|----------------|
| **Functions** | Single-word names, `Effect.fn("Domain.action")` for named effects | `@ref:functions` |
| **Classes** | `export class Service extends Context.Service<...>()`, Schema.Class for data | `@ref:classes` |
| **Arrays** | Prefer `flatMap`, `filter`, `map` over `for` loops | `@ref:arrays` |
| **Variables** | `const` over `let`, ternaries over reassignment, inline single-use values | `@ref:variables` |
| **Control Flow** | Early returns, no `else`, happy-path-first | `@ref:control-flow` |
| **Async** | Effect.gen with yield*, not async/await in effect code | `@ref:async` |
| **Types** | No `any`, prefer branded schemas and Schema.Class | `@ref:types` |
| **Imports** | Flat exports with `export * as Foo from "./foo"`, no barrel indices | `@ref:imports` |
| **Testing** | `testEffect()`, `it.instance()`, `it.live()`, no mocks | `@ref:testing` |
| **Docs** | Minimal comments, no JSDoc, comments for non-obvious constraints | `@ref:docs` |

---

## Essential Patterns

```typescript
// Service pattern — one file per service
export interface Interface { ... }
export class Service extends Context.Service<Service, Interface>()("@talon/Foo") {}
export const layer = Layer.effect(Service, Effect.gen(function* () { ... }))
export const defaultLayer = layer.pipe(...)
export * as Foo from "./foo"

// Effect function pattern
const myFn = Effect.fn("Domain.action")(function* (input: Input) {
  const svc = yield* Service
  return yield* svc.doThing(input)
})

// Schema pattern
export const MySchema = Schema.Struct({ ... })
export type MySchema = Schema.Schema.Type<typeof MySchema>
```

---

## Reference Load Commands

To load full standards for a specific area, agents use:
```
@load: core/standards/TYPE  (e.g., @load: typescript, @load: testing)
```

| Code | File | Lines | Priority |
|------|------|-------|----------|
| `@ref:functions` | `.talon/context/core/standards/typescript.md` | <200 | High |
| `@ref:testing` | `.talon/context/core/standards/test-coverage.md` | <150 | High |
| `@ref:types` | `.talon/context/core/standards/typescript.md` | <200 | High |
| `@ref:docs` | `.talon/context/core/standards/documentation.md` | <100 | Medium |
| `@ref:security` | `.talon/context/core/standards/security-patterns.md` | <150 | Critical |

---

## Previously Covered (RTK'd — load on demand)

The following topics were fully documented in v1 but are now referenced via their standard files:

- **Function Definition** → `core/standards/typescript.md` + `core/standards/code-quality.md`
- **Class Usage** → `core/standards/code-quality.md`  
- **Array Handling** → `core/standards/typescript.md`
- **Control Flow** → `core/standards/code-quality.md`
- **Async & Concurrency** → `core/standards/code-quality.md`
- **State Management** → `core/standards/code-quality.md`
- **Error Handling** → `core/standards/code-quality.md`
- **Import Organization** → `core/standards/typescript.md`
- **Naming Conventions** → `core/standards/code-quality.md`
- **Build & Development** → Developer's own tooling (tsconfig, bunfig)
- **Performance & Security** → `core/standards/security-patterns.md`
