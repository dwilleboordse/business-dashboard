import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

const KEY = "dashboard:state";

let redis: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = Redis.fromEnv();
}

export async function GET() {
  if (!redis) {
    return NextResponse.json(
      { error: "Storage not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN." },
      { status: 503 },
    );
  }
  const data = await redis.get(KEY);
  return NextResponse.json(data ?? null);
}

export async function PUT(req: Request) {
  if (!redis) {
    return NextResponse.json(
      { error: "Storage not configured." },
      { status: 503 },
    );
  }
  const body = await req.json();
  await redis.set(KEY, body);
  return NextResponse.json({ ok: true });
}
