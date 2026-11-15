import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/server/auth";
import { generateNursePreCallBrief } from "@/server/verda/client";
import { STORED_WARNING_KINDS } from "@/domain/ai-support";

export const dynamic = "force-dynamic";

const buckets = new Map<string, number[]>();

function isRateLimited(): boolean {
  const now = Date.now();
  const prev = (buckets.get("nurse-brief") ?? []).filter((t) => t > now - 60_000);
  if (prev.length >= 30) {
    buckets.set("nurse-brief", prev);
    return true;
  }
  prev.push(now);
  buckets.set("nurse-brief", prev);
  return false;
}

function isSameOrigin(request: Request): boolean {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const candidate = request.headers.get("origin") ?? request.headers.get("referer");
  if (!host || !candidate) return false;
  try {
    return new URL(candidate).host.toLowerCase() === host.split(",")[0].trim().toLowerCase();
  } catch {
    return false;
  }
}

const nurseBriefBodySchema = z
  .object({
    participantCode: z.string().min(2).max(64),
    sinceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    triggerKind: z.enum(STORED_WARNING_KINDS),
    broadAreas: z.array(z.string().min(1).max(40)).min(1).max(5),
    ringActiveDuringSilence: z.boolean().nullable(),
    metrics: z
      .array(
        z.object({
          label: z.string().min(1).max(64),
          valueText: z.string().min(1).max(32),
        })
      )
      .max(8),
    isSimulated: z.boolean().default(true),
  })
  .strict();

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Cross-origin POST rejected." },
      { status: 403 }
    );
  }
  const auth = requireApiSession(request, "staff");
  if (!auth.ok) {
    return auth.response;
  }
  if (isRateLimited()) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = nurseBriefBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid nurse-brief parameters." },
      { status: 400 }
    );
  }

  const response = await generateNursePreCallBrief(parsed.data);
  return NextResponse.json({
    ok: true,
    isSimulated: parsed.data.isSimulated,
    ...response,
  });
}
