import { cookies } from "next/headers";

// The scope a visitor chose is remembered in a cookie so the public surfaces
// (landing + auth) can be shown under it before the user logs in.
export const SCOPE_COOKIE = "scope_id";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function getSelectedScopeIdFromCookie(): Promise<number | null> {
  const raw = (await cookies()).get(SCOPE_COOKIE)?.value;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Must be called from a Server Action or Route Handler so the cookie can be set.
export async function setSelectedScopeCookie(scopeId: number): Promise<void> {
  (await cookies()).set(SCOPE_COOKIE, String(scopeId), {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
}
