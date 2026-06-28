/**
 * Intent Classification — lightweight keyword-based classifier that determines
 * what kind of response a user message is asking for.
 *
 * Inspired by oh-my-openagent's IntentGate. Classifies user intent into
 * categories that can be used to tweak the system prompt or suggest an agent.
 *
 * The classifier is intentionally simple (regex + keyword matching) so it
 * adds negligible latency. A future enhancement could use an LLM call for
 * deeper classification.
 */

// ---------------------------------------------------------------------------
// Intent types
// ---------------------------------------------------------------------------

export const INTENTS = [
  "edit",
  "explain",
  "search",
  "architect",
  "question",
  "general",
] as const

export type Intent = (typeof INTENTS)[number]

export interface IntentResult {
  /** Classified intent */
  intent: Intent
  /** Confidence score 0-1 (heuristic-based) */
  confidence: number
  /** Matched keywords for transparency */
  matches: string[]
  /** Suggested agent name that best matches this intent */
  suggestedAgent: string
  /** System prompt snippet to inject */
  systemHint: string
}

// ---------------------------------------------------------------------------
// Classification patterns
// ---------------------------------------------------------------------------

interface IntentRule {
  intent: Intent
  /** Priority — higher wins on tie */
  priority: number
  /** Keyword patterns to match against the user message */
  keywords: RegExp[]
  /** System prompt hint to inject */
  hint: string
  /** Suggested agent */
  agent: string
}

const RULES: IntentRule[] = [
  {
    intent: "edit",
    priority: 20,
    keywords: [
      /(?:create|write|implement|add|build|make|develop)\s+(?:a|an|the|new)/i,
      /(?:change|modify|update|refactor|rewrite|fix|correct|improve)/i,
      /(?:edit|change)\s+(?:this|the|that)\s+(?:file|code|function|class|method)/i,
      /\b(?:implement|code\s+up)\b/i,
      /(?:add|remove|delete)\s+(?:feature|functionality|support)/i,
    ],
    hint: "The user wants to edit or create code. Focus on implementation.",
    agent: "build",
  },
  {
    intent: "explain",
    priority: 15,
    keywords: [
      /^(?:what|how|why|when|where|which|who)\s+/i,
      /\b(?:explain|describe|understand|clarify|elaborate|break\s+down)\b/i,
      /\b(?:how\s+does|what\s+does|what\s+is|how\s+to)\b/i,
      /\b(?:meaning|purpose|reason|rationale)\b/i,
    ],
    hint: "The user wants an explanation. Provide clear, detailed context.",
    agent: "explore",
  },
  {
    intent: "search",
    priority: 25,
    keywords: [
      /\b(?:find|search|locate|look\s+for|where\s+is)\b/i,
      /\b(?:show\s+me|list|grep|glob)\b/i,
      /\ball\s+(?:the|of\s+the)\s+(?:files|places|occurrences|references|usages)/i,
      /\bwhere\s+(?:is|are|does)\b.*\b(?:defined|used|called|located)\b/i,
    ],
    hint: "The user wants to find something in the codebase. Prioritize grep/glob/read tools.",
    agent: "explore",
  },
  {
    intent: "architect",
    priority: 30,
    keywords: [
      /\b(?:design|architect|architecture|structure|component\s+diagram)\b/i,
      /\b(?:plan|propose|outline|strategy|approach)\b.*\b(?:for|to)\b/i,
      /\b(?:trade.?off|compare|vs\.?|versus)\b/i,
      /\b(?:how\s+should|what\s+should|recommend|suggest)\b.*\b(?:design|structure|architect)/i,
    ],
    hint: "The user wants architectural or design guidance. Think about structure and trade-offs.",
    agent: "architect",
  },
  {
    intent: "question",
    priority: 10,
    keywords: [
      /\?$/m,
      /\b(?:can\s+you|could\s+you|would\s+you)\b/i,
      /\b(?:is\s+it|are\s+there|does\s+this|do\s+you)\b/i,
    ],
    hint: "The user is asking a question. Answer clearly and directly.",
    agent: "general",
  },
]

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

/**
 * Classify the intent of a user message.
 * Returns the best-matching intent with confidence and matches.
 */
export function classifyIntent(text: string): IntentResult {
  const matches: string[] = []
  let bestIntent: Intent = "general"
  let bestPriority = -1
  let bestCount = 0

  for (const rule of RULES) {
    let count = 0
    for (const pattern of rule.keywords) {
      if (pattern.test(text)) {
        count++
        // Record a representative match
        const execResult = pattern.exec(text)
        if (execResult && matches.length < 5) {
          matches.push(execResult[0].trim().toLowerCase())
        }
        // Only test once per rule to avoid duplicate matches
        break
      }
    }

    if (count > 0 && (rule.priority > bestPriority || (rule.priority === bestPriority && count > bestCount))) {
      bestIntent = rule.intent
      bestPriority = rule.priority
      bestCount = count
    }
  }

  // If no rule matched, it's general
  if (bestCount === 0) {
    return {
      intent: "general",
      confidence: 0.5,
      matches: [],
      suggestedAgent: "build",
      systemHint: "Respond helpfully to the user's request.",
    }
  }

  // Confidence heuristic: higher priority + more matches = more confident
  const confidence = Math.min(0.5 + bestCount * 0.15 + (bestPriority / 30) * 0.3, 0.95)

  const agentMap: Record<Intent, string> = {
    edit: "build",
    explain: "explore",
    search: "explore",
    architect: "architect",
    question: "general",
    general: "build",
  }

  const hintMap: Record<Intent, string> = {
    edit: "The user wants to edit or create code. Focus on implementation.",
    explain: "The user wants an explanation. Provide clear, detailed context.",
    search: "The user wants to find something in the codebase. Prioritize grep/glob/read tools.",
    architect: "The user wants architectural or design guidance. Think about structure and trade-offs.",
    question: "The user is asking a question. Answer clearly and directly.",
    general: "Respond helpfully to the user's request.",
  }

  return {
    intent: bestIntent,
    confidence,
    matches: [...new Set(matches)].slice(0, 3),
    suggestedAgent: agentMap[bestIntent],
    systemHint: hintMap[bestIntent],
  }
}

/**
 * Quick check: is this message asking for code changes?
 * Useful for fast early-exit routing.
 */
export function isEditIntent(text: string): boolean {
  return classifyIntent(text).intent === "edit"
}

/**
 * Quick check: is this message asking for information?
 */
export function isInfoIntent(text: string): boolean {
  const intent = classifyIntent(text).intent
  return intent === "explain" || intent === "search" || intent === "question"
}
