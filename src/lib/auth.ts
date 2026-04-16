/**
 * Auth utilities:
 *  - Token generation & hashing
 *  - PKCE (S256) verification  – required by OAuth 2.1
 *  - Bearer token extraction from Request
 *  - Base URL helper
 */
import { createHash, randomBytes } from "crypto";
import { store } from "./store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a cryptographically random URL-safe string */
export function generateId(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256 hash a token so we never store raw bearer tokens */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Verify PKCE code_challenge against code_verifier (RFC 7636) */
export function verifyPKCE(
  verifier: string,
  challenge: string,
  method: string
): boolean {
  if (method === "S256") {
    const computed = createHash("sha256")
      .update(verifier)
      .digest("base64url");
    return computed === challenge;
  }
  if (method === "plain") {
    return verifier === challenge;
  }
  return false;
}

// ─── Token lifecycle ──────────────────────────────────────────────────────────

/** Create a new access token and persist its hash → userId */
export async function createAccessToken(userId: string): Promise<string> {
  const token = generateId(48);
  await store.setToken(hashToken(token), userId);
  return token;
}

/** Validate an inbound bearer token; returns userId or null */
export async function validateAccessToken(
  token: string
): Promise<string | null> {
  return store.getUserFromToken(hashToken(token));
}

// ─── Request helpers ──────────────────────────────────────────────────────────

/** Extract the raw bearer token from an Authorization header */
export function extractBearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

/** Get this deployment's public base URL (no trailing slash) */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL)
    return process.env.NEXT_PUBLIC_BASE_URL.trim();
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Build a 401 Unauthorized response that triggers the MCP OAuth flow */
export function unauthorizedResponse(): Response {
  const base = getBaseUrl();
  return new Response(
    JSON.stringify({
      error: "unauthorized",
      error_description: "Valid bearer token required",
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
      },
    }
  );
}
