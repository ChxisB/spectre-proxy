export * as EvidenceSchema from "./schema"

import { Schema } from "effect"
import { DateTimeUtcFromMillis } from "effect/Schema"

export const ScenarioStatus = Schema.Literals(["pass", "fail", "pending", "blocked"])
export type ScenarioStatus = Schema.Schema.Type<typeof ScenarioStatus>

export class ScenarioResult extends Schema.Class<ScenarioResult>("Evidence.ScenarioResult")({
  name: Schema.String,
  category: Schema.Literals(["happy", "edge", "regression"]),
  passCondition: Schema.String,
  status: ScenarioStatus,
  assertionMessage: Schema.String,
  surfaceArtifact: Schema.optional(Schema.String),
    capturedAt: DateTimeUtcFromMillis,
}) {}

export class EvidenceEntry extends Schema.Class<EvidenceEntry>("Evidence.EvidenceEntry")({
  id: Schema.String,
  sessionID: Schema.String,
  title: Schema.String,
  goal: Schema.String,
  scenarios: Schema.Array(ScenarioResult),
  totalScenarios: Schema.Number,
  passedScenarios: Schema.Number,
  failedScenarios: Schema.Number,
  filesChanged: Schema.optional(Schema.Array(Schema.String)),
    createdAt: DateTimeUtcFromMillis,
    completedAt: Schema.optional(DateTimeUtcFromMillis),
}) {}

export const EvidenceConfig = Schema.Struct({
  mode: Schema.optional(Schema.Literals(["warn", "block"])),
  directory: Schema.optional(Schema.String),
})

export const EvidenceSummary = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  goal: Schema.String,
  totalScenarios: Schema.Number,
  passedScenarios: Schema.Number,
  failedScenarios: Schema.Number,
    createdAt: DateTimeUtcFromMillis,
})
export type EvidenceSummary = Schema.Schema.Type<typeof EvidenceSummary>
