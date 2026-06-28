export * as WisdomService from "./service"

import path from "path"
import { Context, DateTime, Effect, Layer, Option, Schema } from "effect"
import { FSUtil } from "../fs-util"
import { WisdomEntry, WisdomEntryInput, WisdomQuery, WisdomStore } from "./schema"

const STORE_VERSION = 1

export interface Interface {
  readonly add: (input: typeof WisdomEntryInput.Type) => Effect.Effect<typeof WisdomEntry.Type>
  readonly query: (query: typeof WisdomQuery.Type) => Effect.Effect<Array<typeof WisdomEntry.Type>>
  readonly get: (id: string) => Effect.Effect<Option.Option<typeof WisdomEntry.Type>>
  readonly remove: (id: string) => Effect.Effect<void>
  readonly recordAccess: (id: string) => Effect.Effect<void>
  readonly updateRelevance: (id: string, delta: number) => Effect.Effect<void>
  readonly load: () => Effect.Effect<void>
  readonly save: () => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@talon/v2/Wisdom") {}

let counter = 0
function generateId(): string {
  counter++
  const now = Date.now().toString(36)
  return `wis_${now}_${counter}`
}

export const layer = (wisdomDir: string) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const storePath = path.join(wisdomDir, "wisdom.json")

      let entries: Map<string, typeof WisdomEntry.Type> = new Map()
      let loaded = false

      const load = (): Effect.Effect<void> =>
        loaded
          ? Effect.void
          : Effect.gen(function* () {
              loaded = true
              const data = yield* fs.readFileStringSafe(storePath)
              if (!data) {
                entries = new Map()
                return
              }
              const parsed: unknown = yield* Effect.try({
                try: () => JSON.parse(data),
                catch: (cause) => new FSUtil.FileSystemError({ method: "readJson", cause }),
              })
              const store = Schema.decodeUnknownOption(WisdomStore)(parsed).valueOrUndefined
              if (!store) {
                entries = new Map()
                return
              }
              entries = new Map(store.entries.map((e) => [e.id, e]))
            }).pipe(Effect.ignore)

      const save = (): Effect.Effect<void> =>
        Effect.gen(function* () {
          yield* fs.ensureDir(wisdomDir)
          const store = {
            entries: Array.from(entries.values()),
            version: STORE_VERSION,
          }
          yield* fs.writeJson(storePath, store)
        }).pipe(Effect.ignore)

      const add = (input: typeof WisdomEntryInput.Type) =>
        Effect.gen(function* () {
          yield* load()
          const now = DateTime.makeUnsafe(Date.now())
          const entry = new WisdomEntry({
            id: generateId(),
            insight: input.insight,
            source: input.source,
            sourceSessionID: input.sourceSessionID,
            project: input.project,
            tags: input.tags,
            relevance: input.relevance,
            createdAt: now,
            accessCount: 0,
            lastAccessedAt: undefined,
          })
          entries.set(entry.id, entry)
          yield* save()
          return entry
        })

      const query = (query: typeof WisdomQuery.Type) =>
        Effect.gen(function* () {
          yield* load()
          let results = Array.from(entries.values())

          if (query.project) {
            results = results.filter((e) => e.project === query.project)
          }
          if (query.tags && query.tags.length > 0) {
            results = results.filter((e) => query.tags!.some((tag) => e.tags.includes(tag)))
          }
          if (query.minRelevance !== undefined && query.minRelevance !== null) {
            results = results.filter((e) => e.relevance >= query.minRelevance!)
          }

          results.sort((a, b) => b.relevance * b.accessCount - a.relevance * a.accessCount)

          const limit = query.limit ?? 20
          return results.slice(0, limit)
        })

      const get = (id: string) =>
        Effect.gen(function* () {
          yield* load()
          const found = entries.get(id)
          return found ? Option.some(found) : Option.none()
        })

      const remove = (id: string) =>
        Effect.gen(function* () {
          yield* load()
          entries.delete(id)
          yield* save()
        })

      const recordAccess = (id: string) =>
        Effect.gen(function* () {
          yield* load()
          const existing = entries.get(id)
          if (!existing) return
          const now = DateTime.makeUnsafe(Date.now())
          const updated = new WisdomEntry({
            ...existing,
            accessCount: existing.accessCount + 1,
            lastAccessedAt: now,
          })
          entries.set(id, updated)
          yield* save()
        })

      const updateRelevance = (id: string, delta: number) =>
        Effect.gen(function* () {
          yield* load()
          const existing = entries.get(id)
          if (!existing) return
          const updated = new WisdomEntry({
            ...existing,
            relevance: Math.max(0, Math.min(1, existing.relevance + delta)),
          })
          entries.set(id, updated)
          yield* save()
        })

      return Service.of({
        add,
        query,
        get,
        remove,
        recordAccess,
        updateRelevance,
        load,
        save,
      })
    }),
  )
