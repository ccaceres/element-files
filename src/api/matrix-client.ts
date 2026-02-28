import { matrixTokenManager } from "@/auth/token-manager";

function getBaseUrl(): string {
  return matrixTokenManager.getHomeserver();
}

function normalizePath(path: string): string {
  if (path.startsWith("/_matrix/")) {
    return path;
  }

  if (path.startsWith("/v3/")) {
    return `/_matrix/client${path}`;
  }

  return path;
}

export class MatrixApiError extends Error {
  status: number;
  retryAfterMs?: number;

  constructor(status: number, message: string, retryAfterMs?: number) {
    super(message);
    this.name = "MatrixApiError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

interface MatrixFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  params?: Record<string, string>;
}

export async function matrixFetch<T>(
  path: string,
  options?: MatrixFetchOptions,
): Promise<T> {
  const token = matrixTokenManager.getToken();
  if (!token) {
    throw new MatrixApiError(401, "No Matrix token");
  }

  const url = new URL(`${getBaseUrl()}${normalizePath(path)}`);
  if (options?.params) {
    for (const [key, value] of Object.entries(options.params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    method: options?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const retryAfterRaw = response.headers.get("Retry-After");
    const retryAfterMs = retryAfterRaw
      ? Number.parseInt(retryAfterRaw, 10) * 1000
      : undefined;

    const parsedError = await response.json().catch(() => null);
    const message =
      (parsedError as { error?: string } | null)?.error ?? response.statusText;

    if (response.status === 401) {
      matrixTokenManager.clearToken();
    }

    throw new MatrixApiError(response.status, message, retryAfterMs);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function validateMatrixToken(
  homeserver: string,
  token: string,
): Promise<{ valid: boolean; userId?: string }> {
  try {
    const response = await fetch(`${homeserver}/_matrix/client/v3/account/whoami`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { valid: false };
    }

    const data = (await response.json()) as { user_id?: string };
    return {
      valid: Boolean(data.user_id),
      userId: data.user_id,
    };
  } catch {
    return { valid: false };
  }
}
