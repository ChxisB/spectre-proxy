/**
 * Tmux primitives for Talon AI.
 *
 * Provides effectful tmux operations wrapping the `tmux` CLI.
 */

export * as Tmux from "./tmux"

import { Context, Effect, Layer } from "effect"

// ── Types ──────────────────────────────────────────────────────────────

export const TmuxLayouts = [
  "main-horizontal",
  "main-vertical",
  "tiled",
  "even-horizontal",
  "even-vertical",
] as const
export type TmuxLayout = (typeof TmuxLayouts)[number]

export type TmuxPaneInfo = {
  paneId: string
  sessionId?: string
  windowId?: string
  width?: number
  height?: number
}

export type TmuxSessionInfo = {
  sessionId: string
  name: string
  windows: number
  panes: number
}

// ── Service Interface ──────────────────────────────────────────────────

export interface Interface {
  /** Check if running inside a tmux session */
  readonly isInside: () => Effect.Effect<boolean>
  /** Get the current tmux pane ID (null if not in tmux) */
  readonly currentPaneId: () => Effect.Effect<string | null>
  /** Run an arbitrary tmux command and return the output */
  readonly run: (args: string[]) => Effect.Effect<string>
  /** Spawn a new pane in the current window. Returns the pane ID. */
  readonly spawnPane: (opts?: { command?: string; horizontal?: boolean; size?: number }) => Effect.Effect<string>
  /** Close a pane by ID */
  readonly closePane: (paneId: string) => Effect.Effect<void>
  /** Send keys to a pane */
  readonly sendKeys: (paneId: string, keys: string) => Effect.Effect<void>
  /** Send keys with Enter to a pane */
  readonly sendKeysEnter: (paneId: string, keys: string) => Effect.Effect<void>
  /** Capture pane contents */
  readonly capturePane: (paneId: string) => Effect.Effect<string>
  /** List all tmux sessions */
  readonly listSessions: () => Effect.Effect<TmuxSessionInfo[]>
  /** Kill a tmux session */
  readonly killSession: (sessionId: string) => Effect.Effect<void>
}

// ── Service Tag ────────────────────────────────────────────────────────

export class Service extends Context.Service<Service, Interface>()("@talon/Tmux") {}

// ── Layer ──────────────────────────────────────────────────────────────

function tmux(args: string[]): Effect.Effect<string> {
  return Effect.promise<string>(() =>
    (async () => {
      // @ts-ignore - Bun API available at runtime
      const process = Bun.spawn(["tmux", ...args], { stdout: "pipe", stderr: "pipe" })
      const output = await new Response(process.stdout).text()
      await process.exited
      return output.trim()
    })(),
  ).pipe(Effect.catch(() => Effect.succeed("")))
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const isInside: Interface["isInside"] = () =>
      Effect.sync(() => !!process.env.TMUX)

    const currentPaneId: Interface["currentPaneId"] = () =>
      Effect.sync(() => process.env.TMUX_PANE ?? null)

    const run: Interface["run"] = (args) => tmux(args)

    const spawnPane: Interface["spawnPane"] = (opts) => {
      const args = ["split-window", "-P", "-F", "#{pane_id}"]
      if (opts?.horizontal) args.push("-h")
      else args.push("-v")
      if (opts?.size) args.push("-l", String(opts.size))
      if (opts?.command) args.push(opts.command)
      return tmux(args)
    }

    const closePane: Interface["closePane"] = (paneId) =>
      tmux(["kill-pane", "-t", paneId]).pipe(Effect.catch(() => Effect.void))

    const sendKeys: Interface["sendKeys"] = (paneId, keys) =>
      tmux(["send-keys", "-t", paneId, keys]).pipe(Effect.catch(() => Effect.void))

    const sendKeysEnter: Interface["sendKeysEnter"] = (paneId, keys) =>
      tmux(["send-keys", "-t", paneId, keys, "Enter"]).pipe(Effect.catch(() => Effect.void))

    const capturePane: Interface["capturePane"] = (paneId) =>
      tmux(["capture-pane", "-t", paneId, "-p"])

    const listSessions: Interface["listSessions"] = () =>
      tmux(["list-sessions", "-F", "#{session_id}:#{session_name}:#{window_count}:#{pane_count}"]).pipe(
        Effect.map((output) =>
          output
            .split("\n")
            .filter(Boolean)
            .map((line) => {
              const parts = line.split(":")
              return {
                sessionId: parts[0] ?? "",
                name: parts[1] ?? "",
                windows: parseInt(parts[2] ?? "0"),
                panes: parseInt(parts[3] ?? "0"),
              }
            }),
        ),
      )

    const killSession: Interface["killSession"] = (sessionId) =>
      tmux(["kill-session", "-t", sessionId]).pipe(Effect.catch(() => Effect.void))

    return Service.of({
      isInside,
      currentPaneId,
      run,
      spawnPane,
      closePane,
      sendKeys,
      sendKeysEnter,
      capturePane,
      listSessions,
      killSession,
    })
  }),
)
