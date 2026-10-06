import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getNormativeIntelligenceService } from "@/server/container";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Normative monitor scheduling is not configured." },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result =
    await getNormativeIntelligenceService().verifyAllOrganizations();

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
