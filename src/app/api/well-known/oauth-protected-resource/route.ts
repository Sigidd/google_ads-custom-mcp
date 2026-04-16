/**
 * RFC 9728 — OAuth 2.0 Protected Resource Metadata
 * GET /.well-known/oauth-protected-resource  (rewritten from next.config.ts)
 *
 * Tells MCP clients where to find the authorization server.
 */
import { getBaseUrl } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const base = getBaseUrl();
  return NextResponse.json({
    resource: base,
    authorization_servers: [base],
  });
}
