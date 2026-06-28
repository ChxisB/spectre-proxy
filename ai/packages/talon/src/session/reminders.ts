import { SessionV1 } from "@talon-ai/core/v1/session"
import { Effect } from "effect"
import { Agent } from "@/agent/agent"
import { Session } from "./session"
import { PartID } from "./schema"
import { isUltraworkMode, getUltraworkVariant, type UltraworkVariant } from "./modes"
import * as SessionLoop from "./loop"

import ULTRAWORK from "./prompt/ultrawork.txt"
import ULTRAWORK_GPT from "./prompt/ultrawork-gpt.txt"
import ULTRAWORK_GEMINI from "./prompt/ultrawork-gemini.txt"
import ULTRAWORK_PLANNER from "./prompt/ultrawork-planner.txt"

export const apply = Effect.fn("SessionReminders.apply")(function* (input: {
  messages: SessionV1.WithParts[]
  agent: Agent.Info
  session: Session.Info
}) {
  const userMessage = input.messages.findLast((msg) => msg.info.role === "user")
  if (!userMessage) return input.messages

  // ── Ultrawork mode injection ──────────────────────────────────────────
  // If ultrawork mode is active, inject the mode-specific prompt as a
  // synthetic system-reminder block in the user message.
  if (isUltraworkMode()) {
    const variant = getUltraworkVariant()
    const promptMap: Record<UltraworkVariant, string> = {
      default: ULTRAWORK,
      gpt: ULTRAWORK_GPT,
      gemini: ULTRAWORK_GEMINI,
      planner: ULTRAWORK_PLANNER,
    }
    const ultraworkPrompt: string = promptMap[variant]
    userMessage.parts.push({
      id: PartID.ascending(),
      messageID: userMessage.info.id,
      sessionID: userMessage.info.sessionID,
      type: "text",
      text: ultraworkPrompt,
      synthetic: true,
    })
  }

  // ── Ralph Loop continuation injection ─────────────────────────────────
  // If the loop is active with incomplete tasks, inject the continuation
  // prompt to yank the agent back to work.
  if (SessionLoop.isLoopActive() && SessionLoop.hasIncompleteTasks()) {
    const prompt = SessionLoop.buildContinuationPrompt()
    if (prompt) {
      userMessage.parts.push({
        id: PartID.ascending(),
        messageID: userMessage.info.id,
        sessionID: userMessage.info.sessionID,
        type: "text",
        text: prompt,
        synthetic: true,
      })
      SessionLoop.incrementContinuation()
    }
  }

  return input.messages
})

export * as SessionReminders from "./reminders"
