import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxies the agent status endpoint so the browser can fetch
 * it without CORS issues.
 *
 * Inside Docker: AGENT_INTERNAL_URL=http://agent:8082
 * Local dev:    defaults to http://localhost:8082
 */
const AGENT_URL = process.env.AGENT_INTERNAL_URL || "http://localhost:8082";

export async function GET() {
  const start = Date.now();

  try {
    const res = await fetch(`${AGENT_URL}/`, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    const latency = Date.now() - start;

    return NextResponse.json({
      status: data.status ?? "unknown",
      model: data.model ?? null,
      provider: data.provider ?? null,
      latency,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        model: null,
        provider: null,
        latency: null,
        error: err instanceof Error ? err.message : "Connection failed",
      },
      { status: 200 } // return 200 so the client can display the error gracefully
    );
  }
}
