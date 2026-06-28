// In-memory LRU cache for shell command output.
// Repeated (command + cwd) pairs skip execution entirely, saving both time and
// tokens. Cache entries expire after a configurable TTL.

const DEFAULT_TTL_MS = 60_000 // 60 seconds
const MAX_ENTRIES = 100

export interface CacheEntry {
  output: string
  exitCode: number | null
  metadata: Record<string, unknown>
  timestamp: number
}

// Map preserves insertion order, giving us natural LRU eviction
const cache = new Map<string, CacheEntry>()

export function cacheKey(command: string, cwd: string): string {
  return `${command}\0${cwd}`
}

export function get(key: string): CacheEntry | null {
  const entry = cache.get(key)
  if (!entry) return null

  // Expired
  if (Date.now() - entry.timestamp > DEFAULT_TTL_MS) {
    cache.delete(key)
    return null
  }

  // Move to end (most recently used) by re-inserting
  cache.delete(key)
  cache.set(key, entry)
  return entry
}

export function set(key: string, output: string, exitCode: number | null, metadata: Record<string, unknown>): void {
  // Evict oldest entries if at capacity
  while (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next()
    if (oldest.value === undefined) break
    if (oldest.value === key) break // don't evict the entry we're about to update
    cache.delete(oldest.value)
  }

  cache.set(key, {
    output,
    exitCode,
    metadata,
    timestamp: Date.now(),
  })
}

export function clear(): void {
  cache.clear()
}

export function size(): number {
  return cache.size
}

// Exposed for testing / cache-aware tool behavior
export const config = {
  ttlMs: DEFAULT_TTL_MS,
  maxEntries: MAX_ENTRIES,
}

export * as ShellCache from "./cache"
