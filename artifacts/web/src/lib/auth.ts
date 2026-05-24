export type ReplitUser = {
  id: string;
  name: string;
  roles: string;
  bio: string;
  profileImage: string;
  url: string;
  teams: string;
};

export type SessionState = {
  authenticated: boolean;
  user?: ReplitUser;
};

export async function getSession(): Promise<SessionState> {
  try {
    const res = await fetch("/api/auth/session");
    if (!res.ok) return { authenticated: false };
    return res.json();
  } catch {
    return { authenticated: false };
  }
}
