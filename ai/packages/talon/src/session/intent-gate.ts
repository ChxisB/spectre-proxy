import { classifyIntent } from "@talon-ai/core/session/intent"
import type { CategoryName } from "@talon-ai/core/category"

export interface IntentGateResult {
  intent: string
  category?: CategoryName
  confidence: number
  ultrawork: boolean
  hyperplan: boolean
  team: boolean
  suggestedAgent?: string
  systemHint?: string
  matches: string[]
}

interface CategoryRule {
  intent: string
  patterns: RegExp[]
  category: CategoryName
}

interface ModeRule {
  patterns: RegExp[]
  mode: "ultrawork" | "hyperplan" | "team"
}

interface AgentRule {
  intent: string
  category: CategoryName
  agent: string
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    intent: "architect",
    patterns: [/design|architecture|structure|component/i, /trade.?off|compare|vs/i],
    category: "ultrabrain",
  },
  {
    intent: "edit",
    patterns: [/create|implement|build|make|develop/i],
    category: "deep",
  },
  {
    intent: "edit",
    patterns: [/fix|bug|debug|correct|repair/i],
    category: "deep",
  },
  {
    intent: "search",
    patterns: [/find|search|locate|where/i],
    category: "quick",
  },
  {
    intent: "explain",
    patterns: [/review|check|QA|audit|verify|validate/i],
    category: "unspecified-low",
  },
  {
    intent: "general",
    patterns: [/review|check|QA|audit/i],
    category: "unspecified-low",
  },
]

const MODE_RULES: ModeRule[] = [
  {
    patterns: [/\b(ultrawork|ulw)\b/i],
    mode: "ultrawork",
  },
  {
    patterns: [/\b(hpp|hyperplan)\b/i],
    mode: "hyperplan",
  },
  {
    patterns: [/\b(team|team.?mode)\b/i],
    mode: "team",
  },
]

const AGENT_RULES: AgentRule[] = [
  { intent: "search", category: "quick", agent: "explore" },
  { intent: "architect", category: "ultrabrain", agent: "architect" },
  { intent: "edit", category: "deep", agent: "build" },
  { intent: "explain", category: "deep", agent: "explore" },
]

const CATEGORY_HINTS: Record<CategoryName, string> = {
  "visual-engineering": "Focus on frontend/UI implementation. Consider visual design, layout, and user experience.",
  ultrabrain: "This requires deep architectural reasoning. Think about trade-offs, structure, and design patterns before acting.",
  deep: "Perform thorough analysis and autonomous research. Be comprehensive and self-directed.",
  artistry: "Focus on creative and aesthetic aspects. Prioritize design quality and visual appeal.",
  quick: "Respond quickly and concisely. Prioritize speed over depth.",
  "unspecified-low": "Handle as a general moderate-effort task. Be helpful but concise.",
  "unspecified-high": "Handle as a substantial task requiring careful effort across multiple areas.",
  writing: "Focus on clear, well-structured writing and documentation quality.",
}

const AGENT_HINTS: Record<string, string> = {
  explore: "Prioritize codebase exploration using grep, glob, and read tools.",
  architect: "Focus on architecture, design patterns, and structural decisions.",
  build: "Focus on implementation and code changes.",
}

const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g
const INLINE_CODE_PATTERN = /`[^`]+`/g

function removeCodeBlocks(text: string): string {
  return text.replace(CODE_BLOCK_PATTERN, "").replace(INLINE_CODE_PATTERN, "")
}

export function analyze(
  text: string,
  existingIntent?: string,
): IntentGateResult {
  const cleanText = removeCodeBlocks(text)
  const classified = classifyIntent(cleanText)
  const intent = existingIntent ?? classified.intent
  const matches: string[] = []
  let category: CategoryName | undefined
  let ultrawork = false
  let hyperplan = false
  let team = false
  let suggestedAgent: string | undefined
  let systemHint: string | undefined

    // Category Detection: match intent + keyword patterns to categories
    for (const rule of CATEGORY_RULES) {
      if (rule.intent !== intent) continue
      for (const pattern of rule.patterns) {
        if (pattern.test(cleanText)) {
          category = rule.category
          const execResult = pattern.exec(cleanText)
          if (execResult && matches.length < 5) {
            matches.push(execResult[0].trim().toLowerCase())
          }
          break
        }
      }
    }

    // Mode Detection
    for (const rule of MODE_RULES) {
      for (const pattern of rule.patterns) {
        if (pattern.test(cleanText)) {
          if (rule.mode === "ultrawork") ultrawork = true
          if (rule.mode === "hyperplan") hyperplan = true
          if (rule.mode === "team") team = true
          const execResult = pattern.exec(cleanText)
          if (execResult && matches.length < 5) {
            matches.push(execResult[0].trim().toLowerCase())
          }
          break
        }
      }
    }

  // Agent Suggestion
  for (const rule of AGENT_RULES) {
    if (rule.intent === intent && category) {
      suggestedAgent = rule.agent
      systemHint = AGENT_HINTS[rule.agent]
      break
    }
  }

  // If category is set, use category hint as fallback system hint
  if (category && !systemHint) {
    systemHint = CATEGORY_HINTS[category]
  }

    // Confidence: base from intent classifier + category/mode bonus
    const confidence = Math.min(classified.confidence + (category ? 0.15 : 0) + (ultrawork ? 0.1 : 0), 0.95)

  return {
    intent,
    category,
    confidence,
    ultrawork,
    hyperplan,
    team,
    suggestedAgent,
    systemHint,
    matches: [...new Set(matches)].slice(0, 3),
  }
}
