/**
 * GET /api/auth/google/start
 *
 * Initiates Google OAuth 2.0 flow.
 * Reads session_id from query params, generates a random state,
 * stores state→session_id in Supabase, then redirects to Google OAuth consent.
 */
import { NextRequest, NextResponse } from "next/server";
import { generateId, getBaseUrl } from "@/lib/auth";
import { store } from "@/lib/store";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "session_id is required" },
      { status: 400 }
    );
  }

  // Verify the session exists
  const session = await store.getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      {
        error: "invalid_session",
        error_description: "Session not found or expired. Please restart the authorization flow.",
      },
      { status: 400 }
    );
  }

  // Generate random state and map it to session_id
  const state = generateId(32);
  await store.setGoogleState(state, { sessionId, createdAt: Date.now() });

  const base = getBaseUrl();
  const redirectUri = `${base}/api/auth/google/callback`;

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set(
    "scope",
    "https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/userinfo.email"
  );
  googleAuthUrl.searchParams.set("access_type", "offline");
  googleAuthUrl.searchParams.set("prompt", "consent");
  googleAuthUrl.searchParams.set("state", state);

  return NextResponse.redirect(googleAuthUrl.toString());
}
