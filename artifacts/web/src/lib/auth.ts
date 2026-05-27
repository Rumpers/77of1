export type AuthUser = {
  id: string;
  email?: string;
};

export type SessionState = {
  authenticated: boolean;
  user?: AuthUser;
};

export async function getSession(): Promise<SessionState> {
  try {
    const res = await fetch("/api/auth/session", { credentials: "include" });
    if (!res.ok) return { authenticated: false };
    return res.json();
  } catch {
    return { authenticated: false };
  }
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
}

// ─── Fan OTP (webview-safe, no OAuth popup) ───────────────────────────────────

export async function sendFanOtp(email: string): Promise<{ error?: string }> {
  try {
    const res = await fetch("/api/auth/fan/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      return { error: data.error ?? "Failed to send OTP" };
    }
    return {};
  } catch {
    return { error: "Network error" };
  }
}

export async function verifyFanOtp(
  email: string,
  token: string,
  handle: string,
): Promise<{ fanId?: string; error?: string }> {
  try {
    const res = await fetch("/api/auth/fan/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, token, handle }),
    });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) return { error: (data.error as string) ?? "Invalid OTP" };
    return { fanId: data.fanId as string };
  } catch {
    return { error: "Network error" };
  }
}

// ─── Creator OTP ──────────────────────────────────────────────────────────────

export async function sendCreatorOtp(email: string): Promise<{ error?: string }> {
  try {
    const res = await fetch("/api/auth/creator/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      return { error: data.error ?? "Failed to send OTP" };
    }
    return {};
  } catch {
    return { error: "Network error" };
  }
}

export async function verifyCreatorOtp(
  email: string,
  token: string,
): Promise<{ creatorId?: string; needsOnboarding?: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/creator/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, token }),
    });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) return { error: (data.error as string) ?? "Invalid OTP" };
    return {
      creatorId: data.creatorId as string | undefined,
      needsOnboarding: data.needsOnboarding as boolean | undefined,
    };
  } catch {
    return { error: "Network error" };
  }
}
