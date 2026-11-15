export interface CheckInStateResponse {
  readonly ok: true;
  readonly openRound: {
    readonly number: number;
    readonly localDate: string;
    readonly opensAt: string;
    readonly endsAt: string;
  } | null;
  readonly taps: "waiting" | "answered" | "not_today";
  readonly isPhq9Due: boolean;
  readonly phq9Progress: "not_started" | "unfinished" | "completed";
  readonly hasSuggestionWaiting: boolean;
  readonly extraItem: unknown | null;
  readonly isGad7Due?: boolean;
  readonly gad7Progress?: "not_started" | "unfinished" | "completed";
}

export type ClientApiResult<T> =
  | ({ ok: true } & T)
  | {
      readonly ok: false;
      readonly status: number;
      readonly saved?: boolean;
      readonly error: string;
      readonly showCrisisPath?: boolean;
    };

export async function fetchCheckInState(): Promise<ClientApiResult<CheckInStateResponse>> {
  try {
    const res = await fetch("/api/check-in", {
      method: "GET",
      headers: { accept: "application/json" },
    });
    if (res.status === 401) {
      return { ok: false, status: 401, error: "unauthorized" };
    }
    if (res.status === 503) {
      return { ok: false, status: 503, saved: false, error: "service_unavailable" };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: `http_${res.status}` };
    }
    const data = await res.json();
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, status: 503, saved: false, error: err instanceof Error ? err.message : "network_error" };
  }
}

export async function submitCheckInTaps(input: {
  mood: number;
  interest: number;
}): Promise<ClientApiResult<{ saved: boolean }>> {
  try {
    const res = await fetch("/api/check-in/taps", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(input),
    });
    if (res.status === 401) {
      return { ok: false, status: 401, error: "unauthorized" };
    }
    if (res.status === 503) {
      return { ok: false, status: 503, saved: false, error: "service_unavailable" };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: `http_${res.status}` };
    }
    const data = await res.json();
    return { ok: true, saved: data.saved ?? true };
  } catch (err) {
    return { ok: false, status: 503, saved: false, error: err instanceof Error ? err.message : "network_error" };
  }
}

export async function submitCheckInNotToday(): Promise<ClientApiResult<{ saved: boolean }>> {
  try {
    const res = await fetch("/api/check-in/not-today", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({}),
    });
    if (res.status === 401) {
      return { ok: false, status: 401, error: "unauthorized" };
    }
    if (res.status === 503) {
      return { ok: false, status: 503, saved: false, error: "service_unavailable" };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: `http_${res.status}` };
    }
    const data = await res.json();
    return { ok: true, saved: data.saved ?? true };
  } catch (err) {
    return { ok: false, status: 503, saved: false, error: err instanceof Error ? err.message : "network_error" };
  }
}

export interface SubmitPhq9Result {
  readonly saved: boolean;
  readonly progress: "not_started" | "unfinished" | "completed";
  readonly showCrisisPath: boolean;
}

export async function submitCheckInPhq9(input: {
  itemId: string;
  value: number;
}): Promise<ClientApiResult<SubmitPhq9Result>> {
  const isCrisisSelfHarm = input.itemId === "9" && input.value > 0;
  try {
    const res = await fetch("/api/check-in/phq9", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(input),
    });
    const showCrisis = isCrisisSelfHarm || res.headers.get("x-crisis-path") === "true";
    if (res.status === 401) {
      return { ok: false, status: 401, error: "unauthorized", showCrisisPath: showCrisis };
    }
    if (res.status === 503) {
      return { ok: false, status: 503, saved: false, error: "service_unavailable", showCrisisPath: showCrisis };
    }
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data.message ?? `http_${res.status}`,
        showCrisisPath: showCrisis || data.showCrisisPath === true,
      };
    }
    return {
      ok: true,
      saved: data.saved ?? true,
      progress: data.progress ?? "unfinished",
      showCrisisPath: showCrisis || data.showCrisisPath === true,
    };
  } catch (err) {
    return {
      ok: false,
      status: 503,
      saved: false,
      error: err instanceof Error ? err.message : "network_error",
      showCrisisPath: isCrisisSelfHarm,
    };
  }
}

export interface SubmitGad7Result {
  readonly saved: boolean;
  readonly isComplete: boolean;
}

export async function submitCheckInGad7(input: {
  itemId: string;
  value: number;
}): Promise<ClientApiResult<SubmitGad7Result>> {
  try {
    const res = await fetch("/api/check-in/gad7", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(input),
    });
    if (res.status === 401) {
      return { ok: false, status: 401, error: "unauthorized" };
    }
    if (res.status === 503) {
      return { ok: false, status: 503, saved: false, error: "service_unavailable" };
    }
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data.message ?? `http_${res.status}`,
      };
    }
    return {
      ok: true,
      saved: data.saved ?? true,
      isComplete: data.isComplete ?? false,
    };
  } catch (err) {
    return {
      ok: false,
      status: 503,
      saved: false,
      error: err instanceof Error ? err.message : "network_error",
    };
  }
}

export interface SubmitCrisisAlertResult {
  readonly saved: boolean;
  readonly duplicate?: boolean;
}

export interface SubmitCrisisAlertOptions {
  readonly maxRetries?: number;
  readonly timeoutMs?: number;
  readonly fetchFn?: typeof fetch;
}

async function sendCrisisAlertRequest(
  customFetch: typeof fetch,
  timeoutMs: number
): Promise<ClientApiResult<SubmitCrisisAlertResult>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await customFetch("/api/check-in/crisis", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ screen: "check-in" }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 401) {
      return { ok: false, status: 401, error: "unauthorized", showCrisisPath: true };
    }
    if (res.status === 403) {
      return { ok: false, status: 403, error: "forbidden", showCrisisPath: true };
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        ok: false,
        status: res.status,
        error: data.error ?? `http_${res.status}`,
        showCrisisPath: true,
      };
    }
    const data = await res.json();
    return { ok: true, saved: data.saved ?? true, duplicate: data.duplicate ?? false };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      status: 503,
      saved: false,
      error: err instanceof Error ? err.message : "network_error",
      showCrisisPath: true,
    };
  }
}

/**
 * Sends a crisis alert from the check-in screen in the background.
 *
 * Rules:
 * - Carries NO text or transcript, only { screen: "check-in" }.
 * - Retries a bounded number of times (at most 3 attempts total).
 * - Each attempt has a strict deadline (timeoutMs, default 5000ms).
 * - Always preserves showCrisisPath: true even on failure, never blocking the caller.
 */
export async function submitCheckInCrisisAlert(
  options: SubmitCrisisAlertOptions = {}
): Promise<ClientApiResult<SubmitCrisisAlertResult>> {
  const maxRetries = options.maxRetries ?? 3;
  const timeoutMs = options.timeoutMs ?? 5000;
  const customFetch = options.fetchFn ?? fetch;

  let lastFailure: ClientApiResult<SubmitCrisisAlertResult> = {
    ok: false,
    status: 503,
    saved: false,
    error: "network_error",
    showCrisisPath: true,
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await sendCrisisAlertRequest(customFetch, timeoutMs);
    if (result.ok || result.status < 500) {
      return result;
    }
    lastFailure = result;
  }

  return lastFailure;
}

