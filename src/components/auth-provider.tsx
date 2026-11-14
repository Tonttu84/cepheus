"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthSession, SignInRequest } from "@/lib/auth-types";

export type SignInResult =
  | { ok: true; session: AuthSession }
  | { ok: false; message: string };

export interface AuthContextValue {
  session: AuthSession | null;
  demoMode: boolean;
  isLoading: boolean;
  signIn: (req: SignInRequest) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface SessionApiResponse {
  ok?: boolean;
  session?: AuthSession | null;
  demoMode?: boolean;
}

interface SignInApiResponse {
  ok?: boolean;
  session?: AuthSession;
  message?: string;
}

export function AuthProvider({
  children,
  initialSession = null,
}: {
  children: ReactNode;
  initialSession?: AuthSession | null;
}) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(initialSession);
  const [demoMode, setDemoMode] = useState(false);
  const [isLoading, setIsLoading] = useState(initialSession === null);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        setSession(null);
        return;
      }
      const data = (await response.json()) as SessionApiResponse;
      setSession(data.session ?? null);
      setDemoMode(Boolean(data.demoMode));
    } catch {
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const signIn = useCallback(async (req: SignInRequest): Promise<SignInResult> => {
    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(req),
      });
      const data = (await response.json()) as SignInApiResponse;
      if (!response.ok || !data.ok || !data.session) {
        return {
          ok: false,
          message: data.message ?? "Sign-in failed. Please check your details.",
        };
      }
      setSession(data.session);
      router.refresh();
      return { ok: true, session: data.session };
    } catch {
      return {
        ok: false,
        message: "Unable to reach the sign-in service. Please try again.",
      };
    }
  }, [router]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        cache: "no-store",
      });
    } finally {
      setSession(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      demoMode,
      isLoading,
      signIn,
      signOut,
      refreshSession,
    }),
    [session, demoMode, isLoading, signIn, signOut, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
