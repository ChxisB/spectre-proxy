<!-- Context: core/context-paths | Priority: low | Version: 1.0 | Updated: 2026-02-15 -->

---
id: context-paths
name: Context File Path Resolution
---

# Context File Path Resolution

## Resolution Order

Context files are resolved in this order (later sources override earlier ones for conflicting keys):

1. **Global context** (`~/.config/talon/context/`) — user-wide defaults
2. **Local context** (`.talon/context/` in project root) — project-specific, highest priority

This mirrors Talon's own config merging behavior (see [Talon Config Docs](https://talon.ai/docs/config/)).

## What Goes Where

| Content Type | Recommended Location | Why |
|---|---|---|
| **Project Intelligence** (tech stack, patterns, naming) | Local `.talon/context/project-intelligence/` | Project-specific, committed to git, shared with team |
| **Core Standards** (code-quality, docs, tests) | Wherever OAC was installed | Universal standards, same across projects |
| **Personal Defaults** (your preferred patterns) | Global `~/.config/talon/context/project-intelligence/` | Personal coding style across all projects |

## How Merging Works

- If a file exists in **both** local and global, the **local version wins**
- If a file exists **only** in global, it's still loaded (acts as a fallback)
- If a file exists **only** in local, it's loaded normally

**Example**: User installs OAC globally (core standards at `~/.config/talon/context/core/`), then runs `/add-context` in a project (creates `.talon/context/project-intelligence/` locally). The agent loads both: core standards from global, project intelligence from local.

## Path Configuration

```json
{
  "paths": {
    "local": ".talon/context",
    "global": "~/.config/talon/context"
  }
}
```

Set `"global": false` to disable global context loading.

## Environment Variable Override

The installer supports `TALON_INSTALL_DIR` to override the install location:

```bash
export TALON_INSTALL_DIR=~/custom/path
bash install.sh developer
```

Talon itself supports `TALON_CONFIG_DIR` for a custom config directory (see [Talon docs](https://talon.ai/docs/config/)). If set, context files in that directory are loaded alongside global and local configs.

## Migrating Global to Local

If you installed globally but want project-specific context:

```bash
/context migrate
```

This copies `project-intelligence/` from global (`~/.config/talon/context/`) to local (`.talon/context/`), so your project patterns are committed to git and shared with your team. See `/context migrate` for details.

## Common Scenarios

### Scenario 1: Everything Local (Development / Repo Maintainer)
- OAC installed locally via `bash install.sh developer`
- All context in `.talon/context/`
- Committed to git, team shares everything

### Scenario 2: Global Install + Local Project Intelligence
- OAC installed globally via `bash install.sh developer --install-dir ~/.config/talon`
- Core standards at `~/.config/talon/context/core/`
- Run `/add-context` in project → creates `.talon/context/project-intelligence/` locally
- Project intelligence committed to git, core standards come from global

### Scenario 3: Global Personal Defaults
- Run `/add-context --global` to save personal coding patterns
- These apply to ALL projects as fallback
- Any project can override with local `/add-context`
