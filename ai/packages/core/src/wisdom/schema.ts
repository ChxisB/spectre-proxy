export * as WisdomSchema from "./schema"

import { Schema } from "effect"
import { DateTimeUtcFromMillis } from "effect/Schema"

export class WisdomEntry extends Schema.Class<WisdomEntry>("Wisdom.WisdomEntry")({
  id: Schema.String,
  insight: Schema.String,
  source: Schema.Literals(["compaction", "loop", "manual", "tool"]),
  sourceSessionID: Schema.optional(Schema.String),
  project: Schema.optional(Schema.String),
  tags: Schema.Array(Schema.String),
  relevance: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)).check(Schema.isLessThanOrEqualTo(1)),
  createdAt: DateTimeUtcFromMillis,
  accessCount: Schema.Number,
  lastAccessedAt: Schema.optional(DateTimeUtcFromMillis),
}) {}

export class WisdomStore extends Schema.Class<WisdomStore>("Wisdom.WisdomStore")({
  entries: Schema.Array(WisdomEntry),
  version: Schema.Number,
}) {}

export class WisdomEntryInput extends Schema.Class<WisdomEntryInput>("Wisdom.WisdomEntryInput")({
  insight: Schema.String,
  source: Schema.Literals(["compaction", "loop", "manual", "tool"]),
  sourceSessionID: Schema.optional(Schema.String),
  project: Schema.optional(Schema.String),
  tags: Schema.Array(Schema.String),
  relevance: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)).check(Schema.isLessThanOrEqualTo(1)),
}) {}

export class WisdomQuery extends Schema.Class<WisdomQuery>("Wisdom.WisdomQuery")({
  project: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
  limit: Schema.optional(Schema.Number),
  minRelevance: Schema.optional(Schema.Number),
}) {}
