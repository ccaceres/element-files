import { matrixTokenManager } from "@/auth/token-manager";

const DEV_MATRIX_PROXY_PATH = "/matrix-proxy";
const ENV_MATRIX_SERVER_URL =
  (
    (typeof __MATRIX_SERVER_URL__ !== "undefined" ? __MATRIX_SERVER_URL__ : "") ||
    ((import.meta.env.VITE_MATRIX_SERVER_URL as string | undefined) ?? "") ||
    "https://matrix.bsdu.eu"
  ).trim();
const DEV_MATRIX_PROXY_TARGET =
  ((import.meta.env.VITE_MATRIX_PROXY_TARGET as string | undefined) ?? ENV_MATRIX_SERVER_URL).trim();

function normalizeHomeserver(url: string): string {
  return url.replace(/\/+$/, "").toLowerCase();
}

function shouldUseDevMatrixProxy(homeserver: string): boolean {
  if (import.meta.env.MODE !== "development") {
    return false;
  }

  return normalizeHomeserver(homeserver) === normalizeHomeserver(DEV_MATRIX_PROXY_TARGET);
}

function getBaseUrl(): string {
  const homeserver = matrixTokenManager.getHomeserver();
  if (shouldUseDevMatrixProxy(homeserver)) {
    return DEV_MATRIX_PROXY_PATH;
  }
  return homeserver;
}

function buildMatrixUrl(path: string): URL {
  const base = getBaseUrl().replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const combined = `${base}${suffix}`;

  if (/^https?:\/\//i.test(combined)) {
    return new URL(combined);
  }

  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost";
  return new URL(combined, origin);
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
  endpoint?: string;
  authMode?: "header" | "query";
  contentType?: string;

  constructor(
    status: number,
    message: string,
    retryAfterMs?: number,
    details?: {
      endpoint?: string;
      authMode?: "header" | "query";
      contentType?: string;
    },
  ) {
    super(message);
    this.name = "MatrixApiError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.endpoint = details?.endpoint;
    this.authMode = details?.authMode;
    this.contentType = details?.contentType;
  }
}

function getMatrixTokenOrThrow(): string {
  const token = matrixTokenManager.getToken();
  if (!token) {
    throw new MatrixApiError(401, "No Matrix token");
  }
  return token;
}

async function toMatrixApiError(
  response: Response,
  details?: {
    endpoint?: string;
    authMode?: "header" | "query";
    contentType?: string;
  },
): Promise<MatrixApiError> {
  const retryAfterRaw = response.headers.get("Retry-After");
  const retryAfterMs = retryAfterRaw
    ? Number.parseInt(retryAfterRaw, 10) * 1000
    : undefined;

  const parsedError = await response.json().catch(() => null);
  const parsedMessage = (parsedError as { error?: string } | null)?.error?.trim();
  const statusText = response.statusText?.trim();
  const message = parsedMessage || statusText || `Matrix API error (${response.status})`;

  if (response.status === 401) {
    matrixTokenManager.clearToken();
  }

  return new MatrixApiError(response.status, message, retryAfterMs, details);
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
  const token = getMatrixTokenOrThrow();

  const url = buildMatrixUrl(normalizePath(path));
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
    throw await toMatrixApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function matrixUploadBlob(
  blob: Blob,
  filename: string,
  contentType?: string,
): Promise<{ content_uri: string }> {
  const token = getMatrixTokenOrThrow();
  const endpoints = [
    "/_matrix/client/v1/media/upload",
    "/_matrix/client/v3/media/upload",
    "/_matrix/media/v3/upload",
    "/_matrix/media/r0/upload",
    "/_matrix/media/v1/upload",
  ];
  const authModes: Array<"header" | "query"> = ["query", "header"];
  let lastError: MatrixApiError | null = null;
  const contentTypes = Array.from(
    new Set([
      contentType || blob.type || "application/octet-stream",
      "application/octet-stream",
    ]),
  );

  async function tryUpload(
    endpoint: string,
    authMode: "header" | "query",
    body: BodyInit,
    contentTypeHeader?: string,
  ): Promise<{ contentUri?: string; error?: MatrixApiError }> {
    const url = buildMatrixUrl(endpoint);
    url.searchParams.set("filename", filename);
    if (authMode === "query") {
      url.searchParams.set("access_token", token);
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (contentTypeHeader) {
      headers["Content-Type"] = contentTypeHeader;
    }
    if (authMode === "header") {
      headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: "POST",
        headers,
        body,
      });
    } catch (networkError) {
      const networkMessage =
        networkError instanceof Error && networkError.message
          ? networkError.message
          : "Network request failed";
      const error = new MatrixApiError(0, networkMessage, undefined, {
        endpoint,
        authMode,
        contentType: contentTypeHeader,
      });
      lastError = error;
      return { error };
    }

    if (response.ok) {
      const parsed = (await response.json()) as { content_uri: string };
      return { contentUri: parsed.content_uri };
    }

    const error = await toMatrixApiError(response, {
      endpoint,
      authMode,
      contentType: contentTypeHeader,
    });
    lastError = error;

    if (error.status === 401) {
      throw error;
    }

    const shouldTryNext =
      error.status === 404 ||
      error.status === 405 ||
      error.status === 415 ||
      error.status === 500 ||
      error.status === 502 ||
      error.status === 503;

    if (!shouldTryNext) {
      throw error;
    }

    return { error };
  }

  for (const endpoint of endpoints) {
    for (const authMode of authModes) {
      for (const type of contentTypes) {
        const rawResult = await tryUpload(endpoint, authMode, blob, type);
        if (rawResult.contentUri) {
          return { content_uri: rawResult.contentUri };
        }
        if (rawResult.error) {
          lastError = rawResult.error;
        }
      }

      // Some homeserver/reverse-proxy setups accept multipart upload while rejecting raw bytes.
      const multipart = new FormData();
      multipart.append("file", blob, filename);
      const multipartResult = await tryUpload(endpoint, authMode, multipart);
      if (multipartResult.contentUri) {
        return { content_uri: multipartResult.contentUri };
      }
      if (multipartResult.error) {
        lastError = multipartResult.error;
      }
    }
  }

  if (lastError) {
    const details = [
      lastError.endpoint ? `endpoint=${lastError.endpoint}` : null,
      lastError.authMode ? `auth=${lastError.authMode}` : null,
      lastError.contentType ? `contentType=${lastError.contentType}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    const message = details
      ? `${lastError.message} (${details})`
      : lastError.message;

    throw new MatrixApiError(lastError.status, message, lastError.retryAfterMs, {
      endpoint: lastError.endpoint,
      authMode: lastError.authMode,
      contentType: lastError.contentType,
    });
  }

  throw new MatrixApiError(500, "Matrix media upload failed");
}

export async function validateMatrixToken(
  homeserver: string,
  token: string,
): Promise<{
  valid: boolean;
  userId?: string;
  status?: number;
  message?: string;
  transient?: boolean;
}> {
  try {
    const baseUrl = shouldUseDevMatrixProxy(homeserver) ? DEV_MATRIX_PROXY_PATH : homeserver;
    const response = await fetch(`${baseUrl}/_matrix/client/v3/account/whoami`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      return {
        valid: false,
        status: response.status,
        message: payload?.error || response.statusText,
      };
    }

    const data = (await response.json()) as { user_id?: string };
    return {
      valid: Boolean(data.user_id),
      userId: data.user_id,
    };
  } catch (error) {
    return {
      valid: false,
      transient: true,
      message: error instanceof Error ? error.message : "Network error during Matrix token validation",
    };
  }
}
