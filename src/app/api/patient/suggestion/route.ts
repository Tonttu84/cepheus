import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/server/auth";
import { verifySameOrigin } from "@/server/security";
import { getRouteDeps } from "@/server/api";
import { getPatientSuggestion, recordSuggestionChoice } from "@/usecases";

export const dynamic = "force-dynamic";

const ChoiceRequestSchema = z
  .object({
    suggestionId: z.string().min(1),
    choice: z.enum(["accepted", "skipped"]),
  })
  .strict();

export async function GET(request: Request) {
  const auth = requireApiSession(request, "patient");
  if (!auth.ok) {
    return auth.response;
  }

  const { actor } = auth.session;
  const { ports } = getRouteDeps();
  const result = await getPatientSuggestion(actor, { patientId: actor.patientId }, ports);
  if (!result.ok) {
    const status = result.error === "not_own_data" ? 403 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, suggestion: result.value.suggestion });
}

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Cross-origin POST rejected." },
      { status: 403 }
    );
  }

  const auth = requireApiSession(request, "patient");
  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ChoiceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request payload" }, { status: 400 });
  }

  const { actor } = auth.session;
  const { ports } = getRouteDeps();
  const result = await recordSuggestionChoice(
    actor,
    {
      patientId: actor.patientId,
      suggestionId: parsed.data.suggestionId,
      choice: parsed.data.choice,
    },
    ports
  );

  if (!result.ok) {
    if (result.error === "already_answered") {
      const storedStatus = "status" in result ? result.status : undefined;
      return NextResponse.json(
        { ok: false, error: result.error, status: storedStatus },
        { status: 409 }
      );
    }
    if (result.error === "not_own_data") {
      return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
    }
    if (result.error === "suggestion_not_found") {
      return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, recorded: true, status: result.value.status });
}
