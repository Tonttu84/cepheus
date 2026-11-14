import { z } from "zod";
import {
  mapFitbitDayToRingDay,
  type FitbitDailyActivitySummary,
  type FitbitHeartDaySummary,
  type FitbitIntradayPoint,
  type FitbitMappedDay,
  type FitbitSleepLog,
} from "@/domain/fitbit";
import { getEnv } from "@/server/env";

const FITBIT_AUTH_URL = "https://www.fitbit.com/oauth2/authorize";
const FITBIT_TOKEN_URL = "https://api.fitbit.com/oauth2/token";
const FITBIT_API_BASE = "https://api.fitbit.com";

export const FITBIT_STATE_COOKIE = "cepheus_fitbit_oauth_state";
export const FITBIT_TOKEN_COOKIE = "cepheus_fitbit_session";

export interface FitbitSealedSession {
  accessToken: string;
  refreshToken: string;
  expiresAtMs: number;
  scope: string;
}

const fitbitTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  scope: z.string().default("activity heartrate sleep"),
  token_type: z.string().default("Bearer"),
});

const fitbitSleepResponseSchema = z.object({
  sleep: z
    .array(
      z.object({
        dateOfSleep: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        duration: z.number().optional(),
        isMainSleep: z.boolean().optional(),
        minutesAsleep: z.number().optional(),
        minutesAwake: z.number().optional(),
        timeInBed: z.number().optional(),
        levels: z
          .object({
            data: z
              .array(
                z.object({
                  dateTime: z.string(),
                  level: z.string(),
                  seconds: z.number(),
                })
              )
              .optional(),
            shortData: z
              .array(
                z.object({
                  dateTime: z.string(),
                  level: z.string(),
                  seconds: z.number(),
                })
              )
              .optional(),
          })
          .optional(),
      })
    )
    .default([]),
});

const fitbitDailyStepsRangeSchema = z.object({
  "activities-steps": z
    .array(
      z.object({
        dateTime: z.string(),
        value: z.string(),
      })
    )
    .default([]),
});

const fitbitIntradayStepsSchema = z.object({
  "activities-steps-intraday": z
    .object({
      dataset: z
        .array(
          z.object({
            time: z.string(),
            value: z.number(),
          })
        )
        .default([]),
    })
    .optional(),
});

const fitbitHeartRangeSchema = z.object({
  "activities-heart": z
    .array(
      z.object({
        dateTime: z.string(),
        value: z
          .object({
            restingHeartRate: z.number().optional(),
          })
          .optional(),
      })
    )
    .default([]),
});

export function isFitbitConfigured(): boolean {
  const env = getEnv();
  return env.FITBIT_CLIENT_ID.length > 0 && env.FITBIT_CLIENT_SECRET.length > 0;
}

export function resolveFitbitRedirectUri(requestUrl: string): string {
  const env = getEnv();
  if (env.FITBIT_REDIRECT_URI.length > 0) {
    return env.FITBIT_REDIRECT_URI;
  }
  const url = new URL(requestUrl);
  return `${url.origin}/api/fitbit/callback`;
}

export function buildFitbitAuthorizeUrl(params: {
  state: string;
  codeChallenge: string;
  redirectUri: string;
}): string {
  const env = getEnv();
  const url = new URL(FITBIT_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.FITBIT_CLIENT_ID);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", "activity heartrate sleep");
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", params.state);
  return url.toString();
}

function buildBasicAuthHeader(): string {
  const env = getEnv();
  const encoded = Buffer.from(
    `${env.FITBIT_CLIENT_ID}:${env.FITBIT_CLIENT_SECRET}`,
    "utf8"
  ).toString("base64");
  return `Basic ${encoded}`;
}

export async function exchangeFitbitCode(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<FitbitSealedSession> {
  const env = getEnv();
  const body = new URLSearchParams({
    client_id: env.FITBIT_CLIENT_ID,
    grant_type: "authorization_code",
    redirect_uri: params.redirectUri,
    code: params.code,
    code_verifier: params.codeVerifier,
  });

  const response = await fetch(FITBIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: buildBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Fitbit token exchange failed with status ${response.status}`);
  }

  const json: unknown = await response.json();
  const parsed = fitbitTokenResponseSchema.parse(json);

  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token,
    expiresAtMs: Date.now() + parsed.expires_in * 1000,
    scope: parsed.scope,
  };
}

export async function refreshFitbitToken(
  refreshToken: string
): Promise<FitbitSealedSession> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(FITBIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: buildBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Fitbit token refresh failed with status ${response.status}`);
  }

  const json: unknown = await response.json();
  const parsed = fitbitTokenResponseSchema.parse(json);

  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token,
    expiresAtMs: Date.now() + parsed.expires_in * 1000,
    scope: parsed.scope,
  };
}

async function fitbitApiGet(path: string, accessToken: string): Promise<unknown> {
  const response = await fetch(`${FITBIT_API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Fitbit API GET ${path} failed with status ${response.status}`);
  }
  return response.json();
}

function listIsoDatesEndingOn(endDate: string, count: number): string[] {
  const [y, m, d] = endDate.split("-").map(Number);
  const dates: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1, d - i));
    dates.push(dt.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Pulls the last `dayCount` days (default 7) of Fitbit sleep, daily/intraday steps,
 * and resting heart rate, returning mapped Cepheus `FitbitMappedDay[]`.
 * Refreshes the token automatically if near expiry.
 */
export async function fetchFitbitWindowDays(
  session: FitbitSealedSession,
  endDate: string,
  dayCount = 7
): Promise<{
  days: FitbitMappedDay[];
  updatedSession: FitbitSealedSession;
  intradayUsed: boolean;
}> {
  let activeSession = session;
  if (Date.now() > session.expiresAtMs - 60_000) {
    activeSession = await refreshFitbitToken(session.refreshToken);
  }

  const dates = listIsoDatesEndingOn(endDate, dayCount);
  const startDate = dates[0];

  const [sleepRaw, stepsRangeRaw, heartRangeRaw] = await Promise.all([
    fitbitApiGet(
      `/1.2/user/-/sleep/date/${startDate}/${endDate}.json`,
      activeSession.accessToken
    ),
    fitbitApiGet(
      `/1/user/-/activities/steps/date/${startDate}/${endDate}.json`,
      activeSession.accessToken
    ),
    fitbitApiGet(
      `/1/user/-/activities/heart/date/${startDate}/${endDate}.json`,
      activeSession.accessToken
    ),
  ]);

  const sleepParsed = fitbitSleepResponseSchema.parse(sleepRaw);
  const stepsParsed = fitbitDailyStepsRangeSchema.parse(stepsRangeRaw);
  const heartParsed = fitbitHeartRangeSchema.parse(heartRangeRaw);

  // Attempt intraday 15-min steps per day (available for Personal-type Fitbit apps).
  // Gracefully falls back to null hourly arrays if the app lacks intraday scope.
  let intradayUsed = false;
  const intradayByDate = new Map<string, FitbitIntradayPoint[]>();
  const intradayResults = await Promise.allSettled(
    dates.map(async (date) => {
      const raw = await fitbitApiGet(
        `/1/user/-/activities/steps/date/${date}/1d/15min.json`,
        activeSession.accessToken
      );
      const parsed = fitbitIntradayStepsSchema.parse(raw);
      return {
        date,
        dataset: parsed["activities-steps-intraday"]?.dataset ?? [],
      };
    })
  );

  for (const res of intradayResults) {
    if (res.status === "fulfilled" && res.value.dataset.length > 0) {
      intradayUsed = true;
      intradayByDate.set(res.value.date, res.value.dataset);
    }
  }

  const stepsByDate = new Map<string, number>();
  for (const item of stepsParsed["activities-steps"]) {
    const num = Number(item.value);
    if (Number.isFinite(num)) {
      stepsByDate.set(item.dateTime, num);
    }
  }

  const heartByDate = new Map<string, FitbitHeartDaySummary>();
  for (const item of heartParsed["activities-heart"]) {
    heartByDate.set(item.dateTime, {
      date: item.dateTime,
      restingHeartRate: item.value?.restingHeartRate ?? null,
    });
  }

  const days: FitbitMappedDay[] = dates.map((date, idx) => {
    const sleepLogs: FitbitSleepLog[] = sleepParsed.sleep.filter(
      (s) => s.dateOfSleep === date
    );
    const activity: FitbitDailyActivitySummary = {
      date,
      steps: stepsByDate.get(date) ?? null,
      intradaySteps: intradayByDate.get(date) ?? null,
    };
    const heart = heartByDate.get(date) ?? null;

    return mapFitbitDayToRingDay({
      date,
      dayIndex: idx + 1,
      sleepLogs,
      activity,
      heart,
    });
  });

  return {
    days,
    updatedSession: activeSession,
    intradayUsed,
  };
}
