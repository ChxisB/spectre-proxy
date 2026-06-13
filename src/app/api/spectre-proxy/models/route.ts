import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AGENT_URL = process.env.AGENT_INTERNAL_URL || "http://localhost:8082";

export async function GET() {
  try {
    const res = await fetch(`${AGENT_URL}/v1/models`, {
      signal: AbortSignal.timeout(10000),
      headers: { "x-api-key": "spectre-proxy" },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Agent error (${res.status})`, data: [] }, { status: 200 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Connection failed", data: [] },
      { status: 200 }
    );
  }
}
