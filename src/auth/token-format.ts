export function normalizeAccessToken(raw: string): string {
  let token = raw.trim();
  token = token.replace(/^['"]+|['"]+$/g, "");
  token = token.replace(/^Bearer\s+/i, "");
  token = token.replace(/\s+/g, "");
  return token;
}

