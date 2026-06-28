<!-- Context: workflows/agent-pipeline | Priority: critical | Version: 1.0 | Updated: 2026-06-28 -->
# Agent Pipeline — Who Does What

> **Purpose**: Clear map of the entire agent workflow — which agent handles each stage, how they delegate, and in what order.

---

## Pipeline Overview

```
USER REQUEST
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│                    TalonAgent / TalonCoder                  │
│              (Primary Orchestrator — route + dispatch)    │
└──────────────────────────────────────────────────────────┘
    │
    ├──── STAGE 1: DISCOVER ────────────────────────────────
    │   ContextScout — find relevant context files
    │   ExternalScout — fetch external library docs
    │
    ├──── STAGE 2: PLAN ────────────────────────────────────
    │   ArchitectureAnalyzer — bounded contexts, components
    │   StoryMapper — user journeys, epics, stories
    │   PrioritizationEngine — RICE/WSJF scoring
    │   ADRManager — architecture decisions
    │   TaskManager → subtask_NN.json breakdown
    │
    ├──── STAGE 3: DEFINE ──────────────────────────────────
    │   ContractManager — API interfaces, schemas
    │
    ├──── STAGE 4: BUILD ───────────────────────────────────
    │   BatchExecutor → CoderAgent(s) — parallel implementation
    │   OpenFrontendSpecialist — UI/UX design (4-stage workflow)
    │   TestEngineer — TDD, test suites
    │
    └──── STAGE 5: VERIFY ──────────────────────────────────
        CodeReviewer — security, quality, architecture review
        BuildAgent — type check, lint, build
        DocWriter — documentation
```

---

## Agent Responsibilities

### Primary Orchestrators

| Agent | When Used | Delegates To |
|-------|-----------|-------------|
| **TalonAgent** | General-purpose tasks, any domain | ContextScout, TaskManager, CoderAgent, CodeReviewer, TestEngineer, BuildAgent, DocWriter |
| **TalonCoder** | Development/coding tasks | ArchitectureAnalyzer, StoryMapper, TaskManager, BatchExecutor, CoderAgent, CodeReviewer, BuildAgent |

### Stage 1: Discover

| Agent | Role | Delegation Pattern |
|-------|------|-------------------|
| **ContextScout** | Find relevant `.talon/context/` files by priority | Called directly by orchestrator |
| **ExternalScout** | Fetch live docs for external libraries | Called when framework/lib is identified |

### Stage 2: Plan

| Agent | Role | Delegation Pattern |
|-------|------|-------------------|
| **ArchitectureAnalyzer** | DDD analysis — bounded contexts, aggregates, entities, domain events | Called by orchestrator → outputs `contexts.json` |
| **StoryMapper** | User personas → journeys → vertical slices → stories | Called by orchestrator → outputs `map.json` |
| **PrioritizationEngine** | Score stories by RICE / WSJF | Called by orchestrator → outputs priority order |
| **ADRManager** | Record architecture decisions | Called when design decisions need documentation |
| **TaskManager** | Break stories into `subtask_NN.json` files | Called by orchestrator → delegates to ContextScout, ExternalScout |

### Stage 3: Define

| Agent | Role | Delegation Pattern |
|-------|------|-------------------|
| **ContractManager** | Define TypeScript interfaces, API schemas, data contracts | Called by orchestrator → outputs interface files |

### Stage 4: Build

| Agent | Role | Delegation Pattern |
|-------|------|-------------------|
| **BatchExecutor** | Run independent subtasks in parallel | Called by orchestrator → delegates to CoderAgent × N |
| **CoderAgent** | Implement one atomic subtask | Called by BatchExecutor or directly by orchestrator |
| **OpenFrontendSpecialist** | UI/UX design (4-stage: Layout→Theme→Animation→Implement) | Called by orchestrator when UI work is needed |
| **TestEngineer** | Write test suites (positive + negative tests) | Called after implementation → runs tests before handoff |

### Stage 5: Verify

| Agent | Role | Delegation Pattern |
|-------|------|-------------------|
| **CodeReviewer** | Review code for bugs, security issues, quality | Called after implementation → never modifies code |
| **BuildAgent** | Type check, lint, build validation | Called before merge → runs `tsc` / `bun run build` |
| **DocWriter** | Write/update documentation | Called when docs need updating |

---

## Delegation Syntax

Agents pass work to each other using the `task()` function:

```typescript
// Orchestrator → Planner
task(subagent_type="ArchitectureAnalyzer", description="Analyze auth system", prompt="...")

// Planner → Builder  
task(subagent_type="TaskManager", description="Break down auth stories", prompt="...")

// Orchestrator → Batch
task(subagent_type="BatchExecutor", description="Execute Batch 1", prompt="...")

// Batch → Individual CoderAgents (handled internally by BatchExecutor)
// Each gets its own subtask

// Orchestrator → Reviewer
task(subagent_type="CodeReviewer", description="Review auth implementation", prompt="...")

// Orchestrator → Tester
task(subagent_type="TestEngineer", description="Write auth tests", prompt="...")

// Orchestrator → Builder
task(subagent_type="BuildAgent", description="Validate build", prompt="...")
```

---

## Stage Transitions

```
DISCOVER ──→ PLAN ──→ DEFINE ──→ BUILD ──→ VERIFY
                                      ↑
                           (loop: fix issues)
```

Each stage has explicit **exit criteria**:
- **Discover complete**: All relevant context files identified
- **Plan complete**: Architecture analyzed, stories mapped, tasks broken down
- **Define complete**: Contracts/interfaces defined
- **Build complete**: All subtasks implemented, self-review passed
- **Verify complete**: Code reviewed, tests pass, build succeeds

---

## Example: Implementing a Feature

```
User: "Add user authentication"
    │
    ▼
TalonCoder
    │
    ├── ContextScout → find auth standards, security patterns
    ├── ArchitectureAnalyzer → decompose: UserService, AuthService, TokenService
    ├── StoryMapper → register, login, refresh, reset stories
    ├── PrioritizationEngine → Phase 1: register+login, Phase 2: refresh+reset
    ├── TaskManager → task.json + subtask_01.json through subtask_06.json
    ├── ContractManager → AuthService interface, CreateUserData type
    │
    ├── BatchExecutor (Batch 1)
    │   ├── CoderAgent → subtask_01: setup project structure
    │   ├── CoderAgent → subtask_02: database schema
    │   └── CoderAgent → subtask_03: install deps
    │
    ├── BatchExecutor (Batch 2)
    │   ├── CoderAgent → subtask_04: User Service
    │   └── CoderAgent → subtask_05: Token Service
    │
    ├── CoderAgent → subtask_06: Auth Service (depends on 04+05)
    │
    ├── TestEngineer → write auth tests
    ├── CodeReviewer → review auth implementation
    └── BuildAgent → type check + build
```

---

## Related

- `task-delegation-specialists.md` — detailed delegation patterns
- `multi-stage-orchestration.md` — full 8-stage orchestration
- `code-review.md` — code review process
- `../standards/navigation.md` — project standards
- `../context-system/guides/rtk.md` — RTK token optimization (80%+ savings)
- `../context-system/guides/compact.md` — File compression techniques
- `../context-system/standards/mvi.md` — Minimal Viable Information
- `task-delegation-caching.md` — Context caching for cost savings
