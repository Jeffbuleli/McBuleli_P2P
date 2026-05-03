/**
 * Vide = même origine que le front : Next.js proxifie `/api/*` vers Express (voir `next.config.ts`).
 * Évite CORS et les écarts localhost vs 127.0.0.1 en dev.
 * Pour appeler l’API sur un autre domaine (prod / tunnel), définir `NEXT_PUBLIC_API_URL`.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();

const FETCH_TIMEOUT_MS = 60_000;

async function fetchApi(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      e instanceof TypeError ||
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("Load failed")
    ) {
      throw new Error("NETWORK_UNAVAILABLE");
    }
    throw e;
  }
}

/** Abort after FETCH_TIMEOUT_MS — works even when AbortSignal.timeout is missing (older Safari). */
function defaultTimeoutSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(FETCH_TIMEOUT_MS);
  }
  if (typeof AbortController !== "undefined") {
    const c = new AbortController();
    setTimeout(() => c.abort(), FETCH_TIMEOUT_MS);
    return c.signal;
  }
  return undefined;
}

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

/**
 * Lit le corps d’une réponse d’erreur : JSON Express ou HTML/page Next si le proxy échoue.
 * Évite d’afficher le libellé HTTP brut « Internal Server Error ».
 */
async function parseHttpError(res: Response): Promise<string> {
  const text = await res.text();
  const trimmed = text.trim();
  let parsed: Partial<ApiError> = {};
  if (trimmed.startsWith("{")) {
    try {
      parsed = JSON.parse(trimmed) as Partial<ApiError>;
    } catch {
      /* corps non JSON */
    }
  }
  if (parsed.error !== undefined) {
    const msg = messageFromApiError(parsed.error);
    if (msg) return msg;
  }

  const st = res.status;
  if (st === 502 || st === 503 || st === 504) return "NETWORK_UNAVAILABLE";

  const looksLikeHtmlOrGeneric =
    !trimmed ||
    trimmed.startsWith("<") ||
    /internal\s+server\s+error/i.test(text) ||
    /bad\s+gateway/i.test(text);

  if (st >= 500 && looksLikeHtmlOrGeneric) return "NETWORK_UNAVAILABLE";

  if (st >= 500) return "INTERNAL";

  const statusText = res.statusText?.trim();
  if (statusText && !/^internal server error$/i.test(statusText)) return statusText;

  return "NETWORK_UNAVAILABLE";
}

export type ApiError = { error: string | Record<string, unknown> };

function getTokens() {
  if (typeof window === "undefined") return { access: null as string | null };
  return {
    access: localStorage.getItem("accessToken"),
    refresh: localStorage.getItem("refreshToken"),
  };
}

/** GET/POST with Bearer + refresh on 401. Path must start with `/api/…`. */
export async function authenticatedFetch(path: string, init?: RequestInit): Promise<Response> {
  const { access, refresh } = getTokens();
  const headers: HeadersInit = {
    ...(init?.headers ?? {}),
  };
  if (access) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${access}`;
  }
  let res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    signal: init?.signal ?? defaultTimeoutSignal(),
  });

  if (res.status === 401 && refresh && path !== "/api/auth/refresh") {
    const r2 = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
      credentials: "omit",
      signal: init?.signal ?? defaultTimeoutSignal(),
    });
    if (r2.ok) {
      const j = (await r2.json()) as { accessToken: string; refreshToken: string };
      localStorage.setItem("accessToken", j.accessToken);
      localStorage.setItem("refreshToken", j.refreshToken);
      (headers as Record<string, string>)["Authorization"] = `Bearer ${j.accessToken}`;
      res = await fetchApi(`${API_BASE}${path}`, {
        ...init,
        headers,
        signal: init?.signal ?? defaultTimeoutSignal(),
      });
    }
  }

  return res;
}

export async function api<T>(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<T> {
  const auth = init?.auth !== false;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init?.headers ?? {}),
  };

  let res: Response;
  if (!auth) {
    res = await fetchApi(`${API_BASE}${path}`, {
      ...init,
      headers,
      signal: init?.signal ?? defaultTimeoutSignal(),
    });
  } else {
    res = await authenticatedFetch(path, { ...init, headers });
  }

  if (!res.ok) {
    throw new Error(await parseHttpError(res));
  }
  return res.json() as Promise<T>;
}

/** Télécharge un CSV (ou binaire) depuis une route protégée — déclenche le téléchargement navigateur. */
export async function downloadAuthenticatedBlob(path: string, filename: string): Promise<void> {
  const res = await authenticatedFetch(path, { method: "GET" });
  if (!res.ok) {
    throw new Error(await parseHttpError(res));
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}
