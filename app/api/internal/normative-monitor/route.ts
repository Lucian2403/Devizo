import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getNormativeIntelligenceService } from "@/server/container";

export const dynamic = "force-dynamic";

// Digests have equal length, so the comparison is constant-time regardless of
// the length of the value supplied by the caller.
function hasValidCronSecret(
  authorization: string | null,
  secret: string,
): boolean {
  if (!authorization) return false;
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const received = createHash("sha256").update(authorization).digest();
  return timingSafeEqual(expected, received);
}

export async function GET(request: NextRequest) {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Normative monitor scheduling is not configured." },
      { status: 503 },
    );
  }

  if (!hasValidCronSecret(request.headers.get("authorization"), env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result =
    await getNormativeIntelligenceService().verifyAllOrganizations();

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
