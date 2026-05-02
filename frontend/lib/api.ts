const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Backend often sends Zod `flatten()` objects under `error`, not plain strings */
function messageFromApiError(error: unknown): string {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "Request failed";
  const flat = error as { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
  const parts: string[] = [];
  if (Array.isArray(flat.formErrors)) {
    for (const x of flat.formErrors) if (x) parts.push(x);
  }
  if (flat.fieldErrors && typeof flat.fieldErrors === "object") {
    for (const [key, msgs] of Object.entries(flat.fieldErrors)) {
      if (Array.isArray(msgs) && msgs.length) parts.push(`${key}: ${msgs.join(", ")}`);
    }
  }
  return parts.length ? parts.join(" · ") : JSON.stringify(error);
}

export type ApiError = { error: string | Record<string, unknown> };

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
    const body = (await res.json().catch(() => ({}))) as ApiError;
    const msg = body.error !== undefined ? messageFromApiError(body.error) : res.statusText;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}
