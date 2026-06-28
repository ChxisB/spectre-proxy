export * from "./client.js"
export * from "./server.js"

import { createTalonClient } from "./client.js"
import { createTalonServer } from "./server.js"
import type { ServerOptions } from "./server.js"

export * as data from "./data.js"

export async function createTalon(options?: ServerOptions) {
  const server = await createTalonServer({
    ...options,
  })

  const client = createTalonClient({
    baseUrl: server.url,
  })

  return {
    client,
    server,
  }
}
