import { tokenManager } from "@/auth/token-manager";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export class TokenExpiredError extends Error {
  constructor() {
    super("Token expired");
    this.name = "TokenExpiredError";
  }
}

export class GraphApiError extends Error {
  status: number;

  constructor(status: number, statusText: string, message: string) {
    super(message || `Graph API error: ${status} ${statusText}`);
    this.name = "GraphApiError";
    this.status = status;
  }
}

function buildUrl(path: string, params?: Record<string, string>): URL {
  const url = path.startsWith("http")
    ? new URL(path)
    : new URL(`${GRAPH_BASE}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return url;
}

async function throwGraphError(res: Response): Promise<never> {
  const bodyText = await res.text();
  let message = bodyText;

  if (!bodyText) {
    message = `Graph API error: ${res.status} ${res.statusText}`;
  } else {
    try {
      const parsed = JSON.parse(bodyText) as {
        error?: { message?: string; code?: string };
      };
      message = parsed.error?.message || message;
    } catch {
      // Keep raw text when response is not JSON.
    }
  }

  throw new GraphApiError(res.status, res.statusText, message);
}

function getAuthHeaders(initHeaders?: HeadersInit): Headers {
  const token = tokenManager.getToken();
  if (!token) {
    throw new TokenExpiredError();
  }

  const headers = new Headers(initHeaders);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  return headers;
}

export async function graphFetch<T>(
  path: string,
  params?: Record<string, string>,
  init?: RequestInit,
): Promise<T> {
  const url = buildUrl(path, params);
  const headers = getAuthHeaders(init?.headers);

  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url.toString(), {
    ...init,
    headers,
  });

  if (res.status === 401) {
    tokenManager.clearToken("expired");
    throw new TokenExpiredError();
  }

  if (!res.ok) {
    await throwGraphError(res);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }

  return (await res.text()) as T;
}

export async function graphFetchBlob(
  path: string,
  params?: Record<string, string>,
  init?: RequestInit,
): Promise<Blob> {
  const url = buildUrl(path, params);
  const headers = getAuthHeaders(init?.headers);

  const res = await fetch(url.toString(), {
    ...init,
    headers,
  });

  if (res.status === 401) {
    tokenManager.clearToken("expired");
    throw new TokenExpiredError();
  }

  if (!res.ok) {
    await throwGraphError(res);
  }

  return res.blob();
}

export { GRAPH_BASE };

