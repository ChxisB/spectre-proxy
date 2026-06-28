// Native token usage tracking.
// Instead of parsing agent log files (like ccusage does), we record usage
// directly from LLM responses — we own the call path, so we know the exact
// token counts and costs at the time they happen.

import { Context, Effect, Layer, Schema } from "effect"
import { LayerNode } from "@talon-ai/core/effect/layer-node"
import { ProviderV2 } from "@talon-ai/core/provider"
import { ModelV2 } from "@talon-ai/core/model"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const UsageRecord = Schema.Struct({
  timestamp: Schema.Number,
  sessionID: Schema.String,
  providerID: ProviderV2.ID,
  modelID: ModelV2.ID,
  inputTokens: Schema.Number,
  outputTokens: Schema.Number,
  cacheReadTokens: Schema.optional(Schema.Number),
  cacheWriteTokens: Schema.optional(Schema.Number),
  reasoningTokens: Schema.optional(Schema.Number),
  cost: Schema.Number,
  agent: Schema.optional(Schema.String),
})
export type UsageRecord = Schema.Schema.Type<typeof UsageRecord>

// ---------------------------------------------------------------------------
// In-memory usage store
// ---------------------------------------------------------------------------

// Simple ring buffer — keeps the last N records in memory. This is intentionally
// lightweight: no DB writes, no persistence. The data is ephemeral but accurate
// for the session lifetime.
const MAX_RECORDS = 10_000
const records: UsageRecord[] = []

function computeCost(
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number | undefined,
  _cacheWriteTokens: number | undefined,
  inputCostPerToken: number,
  outputCostPerToken: number,
  cacheReadCostPerToken: number,
): number {
  const inputCost = inputTokens * inputCostPerToken
  const outputCost = outputTokens * outputCostPerToken
  const cacheReadCost = (cacheReadTokens ?? 0) * cacheReadCostPerToken
  return inputCost + outputCost + cacheReadCost
}

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface Interface {
  /** Record a single LLM call's usage */
  readonly record: (entry: Omit<UsageRecord, "timestamp" | "cost"> & { cost?: number }) => void
  /** Get all records (newest first) */
  readonly all: () => UsageRecord[]
  /** Aggregate by time period */
  readonly byPeriod: (period: "daily" | "weekly" | "monthly") => {
    period: string
    inputTokens: number
    outputTokens: number
    cost: number
    calls: number
  }[]
  /** Total for the current session */
  readonly total: () => { inputTokens: number; outputTokens: number; cost: number; calls: number }
  /** Clear all records */
  readonly clear: () => void
}

export class Service extends Context.Service<Service, Interface>()("@talon/Usage") {}

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

export const layer = Layer.sync(
  Service,
  () =>
    Service.of({
      record(entry) {
        const rec: UsageRecord = {
          ...entry,
          timestamp: Date.now(),
          cost: entry.cost ?? 0,
        }
        records.push(rec)
        if (records.length > MAX_RECORDS) {
          records.splice(0, records.length - MAX_RECORDS)
        }
      },

      all() {
        return [...records].reverse()
      },

      byPeriod(period) {
        const grouped = new Map<string, { inputTokens: number; outputTokens: number; cost: number; calls: number }>()

        for (const rec of records) {
          const d = new Date(rec.timestamp)
          let key: string
          if (period === "daily") {
            key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
          } else if (period === "weekly") {
            // ISO week number
            const startOfYear = new Date(d.getFullYear(), 0, 1)
            const week = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
            key = `${d.getFullYear()}-W${String(week).padStart(2, "0")}`
          } else {
            key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          }

          const existing = grouped.get(key) ?? { inputTokens: 0, outputTokens: 0, cost: 0, calls: 0 }
          existing.inputTokens += rec.inputTokens
          existing.outputTokens += rec.outputTokens
          existing.cost += rec.cost
          existing.calls++
          grouped.set(key, existing)
        }

        return Array.from(grouped.entries())
          .map(([period, data]) => ({ period, ...data }))
          .sort((a, b) => a.period.localeCompare(b.period))
      },

      total() {
        let inputTokens = 0
        let outputTokens = 0
        let cost = 0
        for (const rec of records) {
          inputTokens += rec.inputTokens
          outputTokens += rec.outputTokens
          cost += rec.cost
        }
        return { inputTokens, outputTokens, cost, calls: records.length }
      },

      clear() {
        records.length = 0
      },
    }),
)

export const defaultLayer = layer

export const node = LayerNode.make(layer, [])

export * as Usage from "./usage"
