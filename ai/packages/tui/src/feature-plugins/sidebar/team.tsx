import type { TuiPlugin, TuiPluginApi } from "@talon-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, createSignal, createEffect, For, Show } from "solid-js"

const id = "internal:sidebar-team"

// ── Types ──────────────────────────────────────────────────────────────

type TeamMember = {
  name: string
  status: "pending" | "running" | "idle" | "errored" | "completed"
  role?: string
  taskCount?: number
  unreadCount?: number
  color?: string
}

type TeamInfo = {
  name: string
  members: TeamMember[]
  taskSummary?: string
}

// ── View ───────────────────────────────────────────────────────────────

function View(props: { api: TuiPluginApi }) {
  const [open, setOpen] = createSignal(true)
  const [teams, setTeams] = createSignal<TeamInfo[]>([])
  const theme = () => props.api.theme.current

  // Future: fetch team data from the SDK client when team endpoints
  // are available. For now, the panel shows when team mode is active.
  // The config.team field is accessed as any since it may not be in
  // the generated SDK types yet.

  const totalActiveMembers = createMemo(() =>
    teams().reduce((sum, t) => sum + t.members.filter((m) => m.status === "running" || m.status === "idle").length, 0),
  )

  const dot = (status: string) => {
    switch (status) {
      case "running":
        return theme().success
      case "idle":
        return theme().text
      case "errored":
        return theme().error
      case "completed":
        return theme().textMuted
      default:
        return theme().textMuted
    }
  }

  const memberDot = (status: string) => {
    switch (status) {
      case "running":
        return theme().success
      case "idle":
        return theme().warning
      case "errored":
        return theme().error
      case "completed":
        return theme().textMuted
      default:
        return theme().textMuted
    }
  }

  return (
    <Show when={teams().length > 0}>
      <box>
        <box flexDirection="row" gap={1} onMouseDown={() => setOpen((x) => !x)}>
          <text fg={theme().text}>{open() ? "▼" : "▶"}</text>
          <text fg={theme().text}>
            <b>Team</b>
            <Show when={!open()}>
              <span style={{ fg: theme().textMuted }}>
                {" "}
                ({teams().length} team{teams().length > 1 ? "s" : ""}, {totalActiveMembers()} active)
              </span>
            </Show>
          </text>
        </box>
        <Show when={open()}>
          <For each={teams()}>
            {(team) => (
              <box>
                <text fg={dot("running")}>• </text>
                <text fg={theme().text}>
                  {team.name}
                  <Show when={team.taskSummary}>
                    <span style={{ fg: theme().textMuted }}> — {team.taskSummary}</span>
                  </Show>
                </text>
                <For each={team.members}>
                  {(member) => (
                    <box flexDirection="row" gap={1} paddingLeft={2}>
                      <text
                        flexShrink={0}
                        style={{
                          fg: memberDot(member.status),
                        }}
                      >
                        •
                      </text>
                      <text fg={member.color ?? theme().text}>
                        {member.name}
                        <Show when={member.role}>
                          <span style={{ fg: theme().textMuted }}> [{member.role}]</span>
                        </Show>
                        <Show when={member.unreadCount && member.unreadCount > 0}>
                          <span style={{ fg: theme().warning }}> {member.unreadCount} unread</span>
                        </Show>
                      </text>
                    </box>
                  )}
                </For>
              </box>
            )}
          </For>
        </Show>
      </box>
    </Show>
  )
}

// ── Plugin Registration ────────────────────────────────────────────────

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    // Order 350: between LSP (300) and Todo (400)
    order: 350,
    slots: {
      sidebar_content() {
        return <View api={api} />
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
