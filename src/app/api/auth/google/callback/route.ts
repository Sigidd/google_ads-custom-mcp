/**
 * GET /api/auth/google/callback
 *
 * Handles the Google OAuth 2.0 callback after user grants consent.
 * - Validates state against Supabase google_oauth_state table
 * - Exchanges code for tokens
 * - Gets user profile
 * - Derives stable userId = SHA256(google_sub)
 * - Stores credentials in Supabase
 * - Issues MCP auth code
 * - Sets mcp_user_id cookie (1 year)
 * - Redirects to MCP client with code+state (302)
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { generateId, getBaseUrl } from "@/lib/auth";
import { store } from "@/lib/store";

const USER_COOKIE = "mcp_user_id";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle user denial
  if (error) {
    return NextResponse.redirect(
      `${getBaseUrl()}/connect?error=${encodeURIComponent(
        error === "access_denied"
          ? "Google access was denied. Please try again and grant the required permissions."
          : `Google OAuth error: ${error}`
      )}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${getBaseUrl()}/connect?error=${encodeURIComponent(
        "Missing code or state from Google OAuth callback."
      )}`
    );
  }

  // ── Validate state ────────────────────────────────────────────────────────
  const stateData = await store.getGoogleState(state);
  if (!stateData) {
    return NextResponse.redirect(
      `${getBaseUrl()}/connect?error=${encodeURIComponent(
        "Invalid or expired OAuth state. Please restart the authorization flow."
      )}`
    );
  }
  await store.delGoogleState(state);

  const { sessionId } = stateData;

  // Retrieve the MCP session
  const session = await store.getSession(sessionId);
  if (!session) {
    return NextResponse.redirect(
      `${getBaseUrl()}/connect?error=${encodeURIComponent(
        "MCP session expired. Please restart the authorization flow."
      )}`
    );
  }

  const base = getBaseUrl();
  const redirectUri = `${base}/api/auth/google/callback`;

  // ── Exchange code for tokens ──────────────────────────────────────────────
  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResp.ok) {
    const errText = await tokenResp.text().catch(() => "(no body)");
    return NextResponse.redirect(
      `${getBaseUrl()}/connect?error=${encodeURIComponent(
        `Token exchange failed: ${errText}`
      )}`
    );
  }

  const tokenData = await tokenResp.json();
  const { access_token, refresh_token, expires_in } = tokenData;

  if (!access_token || !refresh_token) {
    return NextResponse.redirect(
      `${getBaseUrl()}/connect?error=${encodeURIComponent(
        "Google did not return a refresh_token. Ensure access_type=offline and prompt=consent were set."
      )}`
    );
  }

  // ── Get user profile ──────────────────────────────────────────────────────
  const userInfoResp = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: { Authorization: `Bearer ${access_token}` },
    }
  );

  if (!userInfoResp.ok) {
    return NextResponse.redirect(
      `${getBaseUrl()}/connect?error=${encodeURIComponent(
        "Failed to fetch Google user info."
      )}`
    );
  }

  const userInfo = await userInfoResp.json();
  const { sub, email } = userInfo;

  // Derive stable userId from Google sub
  const userId = createHash("sha256").update(sub).digest("hex");

  // ── Store credentials ─────────────────────────────────────────────────────
  await store.setCredentials(userId, {
    googleAccessToken: access_token,
    googleRefreshToken: refresh_token,
    tokenExpiresAt: Date.now() + (expires_in ?? 3600) * 1000,
    email: email ?? "",
    connectedAt: Date.now(),
  });

  // ── Issue MCP auth code ───────────────────────────────────────────────────
  await store.delSession(sessionId);
  const authCode = generateId(32);
  await store.setCode(authCode, {
    userId,
    clientId: session.clientId,
    redirectUri: session.redirectUri,
    codeChallenge: session.codeChallenge,
    codeChallengeMethod: session.codeChallengeMethod,
    scope: session.scope,
    createdAt: Date.now(),
  });

  // ── Build redirect URL ────────────────────────────────────────────────────
  const finalRedirect = new URL(session.redirectUri);
  finalRedirect.searchParams.set("code", authCode);
  if (session.state) finalRedirect.searchParams.set("state", session.state);

  // ── Set cookie and redirect (302) ─────────────────────────────────────────
  const response = NextResponse.redirect(finalRedirect.toString(), 302);
  response.cookies.set(USER_COOKIE, userId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });

  return response;
}
