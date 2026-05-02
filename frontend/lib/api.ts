const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ApiError = { error: string };

function getTokens() {
  if (typeof window === "undefined") return { access: null as string | null };
  return {
    access: localStorage.getItem("accessToken"),
    refresh: localStorage.getItem("refreshToken"),
  };
}

export async function api<T>(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<T> {
  const auth = init?.auth !== false;
  const { access, refresh } = getTokens();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init?.headers ?? {}),
  };
  if (auth && access) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${access}`;
  }
  let res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401 && refresh && path !== "/api/auth/refresh") {
    const r2 = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
      credentials: "omit",
    });
    if (r2.ok) {
      const j = (await r2.json()) as { accessToken: string; refreshToken: string };
      localStorage.setItem("accessToken", j.accessToken);
      localStorage.setItem("refreshToken", j.refreshToken);
      (headers as Record<string, string>)["Authorization"] = `Bearer ${j.accessToken}`;
      res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    }
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}
