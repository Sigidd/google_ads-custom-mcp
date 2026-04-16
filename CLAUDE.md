# Google Ads MCP — Context for Claude

## What this project is

A **remote MCP server** that connects Claude to the Google Ads REST API (v18). It is a Next.js app deployed on Vercel, using `@vercel/mcp-adapter`.

**MCP endpoint** (use this URL when adding the connector): `https://your-deployment.vercel.app/mcp`

---

## Architecture

```
Claude → OAuth 2.1 (PKCE) → /api/oauth/authorize
                           → /connect  (user clicks "Connect with Google Ads")
                           → /api/auth/google/start  (initiate Google OAuth)
                           → Google OAuth consent screen
                           → /api/auth/google/callback  (exchange code + store tokens)
                           → Bearer token issued to Claude

Claude tool call → /mcp → withMcpAuth → GoogleAdsClient → Google Ads REST API v18
```

### Dual OAuth flows

1. **OUTER (MCP protocol)**: OAuth 2.1 + PKCE. Claude uses this to authenticate with our server.
2. **INNER (Google)**: Google OAuth 2.0 with `access_type=offline` + `prompt=consent`. We use this to get Google Ads API access.

---

## Key Files

| File | Purpose |
|---|---|
| `src/app/[transport]/route.ts` | MCP endpoint (SSE + HTTP), auth gate |
| `src/lib/tools.ts` | All 35 MCP tool definitions |
| `src/lib/google-ads.ts` | Google Ads REST API client with auto token refresh |
| `src/lib/store.ts` | Supabase persistence layer |
| `src/lib/auth.ts` | Token generation, PKCE, bearer helpers |
| `src/app/connect/page.tsx` | Connect page (server component) |
| `src/app/connect/ConnectForm.tsx` | "Connect with Google Ads" button (client component) |
| `src/app/api/auth/google/start/route.ts` | Initiates Google OAuth redirect |
| `src/app/api/auth/google/callback/route.ts` | Handles Google OAuth callback |
| `src/app/api/oauth/authorize/route.ts` | MCP OAuth 2.1 authorization + silent re-auth |
| `src/app/api/oauth/token/route.ts` | MCP token exchange (code → bearer token) |
| `src/app/api/oauth/register/route.ts` | Dynamic client registration (RFC 7591) |

---

## OAuth Flow Detail

### First-time auth
1. Claude calls `GET /api/oauth/authorize?...&code_challenge=...&code_challenge_method=S256`
2. Server checks `mcp_user_id` cookie → not found
3. Session saved to Supabase, user redirected to `/connect?session_id=xxx`
4. User clicks "Connect with Google Ads"
5. `/api/auth/google/start?session_id=xxx` → generates state, redirects to Google OAuth
6. User grants `adwords` + `userinfo.email` scopes
7. `/api/auth/google/callback?code=xxx&state=xxx` → exchanges code for tokens
8. Gets user info from `https://www.googleapis.com/oauth2/v3/userinfo`
9. `userId = SHA256(google_sub)` — stable across reconnects
10. Credentials stored in Supabase; MCP session deleted; auth code issued
11. `mcp_user_id` cookie set (1 year, httpOnly, secure, sameSite: lax)
12. Redirect 302 to `session.redirectUri?code=xxx&state=xxx`
13. Claude exchanges code → bearer token via `/api/oauth/token`

### Silent re-auth
On step 2 above, if `mcp_user_id` cookie exists AND credentials are valid in Supabase:
- Skip the form entirely
- Issue auth code immediately
- Redirect back to Claude

---

## Google Ads API

### Base URL
```
https://googleads.googleapis.com/v18
```

### Required Headers
```
Authorization: Bearer {access_token}
developer-token: {GOOGLE_ADS_DEVELOPER_TOKEN}
Content-Type: application/json
login-customer-id: {manager_account_id}  # only if using MCC/manager account
```

### GAQL (Google Ads Query Language)
Used for all reporting. Example:
```sql
SELECT campaign.id, campaign.name, metrics.clicks
FROM campaign
WHERE segments.date DURING LAST_7_DAYS
  AND campaign.status = 'ENABLED'
ORDER BY metrics.clicks DESC
LIMIT 100
```

### Token Refresh
Google access tokens expire in 1 hour. The `GoogleAdsClient.getToken()` method auto-refreshes using the stored `refresh_token` if expiry is within 5 minutes. The updated token is persisted to Supabase immediately.

If refresh fails (e.g. refresh token revoked), throws: "Token refresh failed. Please reconnect."

---

## Supabase Schema

```sql
CREATE TABLE IF NOT EXISTS mcp_credentials (
  user_id TEXT PRIMARY KEY,
  data    JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS mcp_oauth_sessions (
  session_id TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS mcp_auth_codes (
  code       TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS mcp_access_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
  client_id TEXT PRIMARY KEY,
  data      JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS google_oauth_state (
  state      TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
GRANT ALL ON mcp_credentials TO anon;
GRANT ALL ON mcp_oauth_sessions TO anon;
GRANT ALL ON mcp_auth_codes TO anon;
GRANT ALL ON mcp_access_tokens TO anon;
GRANT ALL ON mcp_oauth_clients TO anon;
GRANT ALL ON google_oauth_state TO anon;
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_BASE_URL` | Public deployment URL, e.g. `https://google-ads-custom-mcp.vercel.app` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads developer token |

---

## Tools (35 total)

| Category | Tools |
|---|---|
| Account | `list_accessible_customers`, `get_account_summary` |
| Campaigns | `list_campaigns`, `get_campaign`, `create_campaign`, `update_campaign`, `pause_campaign`, `enable_campaign`, `remove_campaign` |
| Ad Groups | `list_ad_groups`, `get_ad_group`, `create_ad_group`, `update_ad_group`, `pause_ad_group` |
| Ads | `list_ads`, `create_responsive_search_ad`, `update_ad` |
| Keywords | `list_keywords`, `add_keywords`, `update_keyword`, `remove_keyword` |
| Budgets | `list_campaign_budgets`, `create_campaign_budget`, `update_campaign_budget` |
| Reports | `get_performance_report`, `get_search_terms_report`, `get_keyword_report`, `get_geographic_report`, `get_device_report`, `execute_gaql_query` |
| Conversions | `list_conversion_actions`, `create_conversion_action` |
| Recommendations | `list_recommendations`, `apply_recommendation`, `dismiss_recommendation` |

---

## Known Gotchas

1. **No middleware.ts** — Do NOT create a `middleware.ts` file. It causes routing conflicts with the MCP handler. The connector points to `/mcp`.

2. **`serverExternalPackages`** — `next.config.ts` must include `@vercel/mcp-adapter` in `serverExternalPackages` to avoid bundling issues on Vercel.

3. **`force-dynamic` on well-known routes** — These routes read env vars at runtime, so they must opt out of static rendering.

4. **302 redirect** — The final redirect from `/api/auth/google/callback` to the MCP client uses HTTP 302 (not 303). NextResponse.redirect defaults to 307, so pass `302` explicitly.

5. **`mcp_user_id` cookie** — httpOnly, secure, sameSite: lax, maxAge 1 year. This enables silent re-auth on all future sessions.

6. **Google refresh_token** — Only returned on first consent or when `prompt=consent` is set. We always set `access_type=offline` and `prompt=consent` to ensure we get it.

7. **Developer token** — Required header for all Google Ads API calls. Obtain from: Google Ads → Admin → API Center.

8. **Customer ID format** — Google Ads customer IDs are 10-digit numbers without dashes. Pass them as strings without dashes (e.g., `"1234567890"` not `"123-456-7890"`).

9. **Connector URL** — Must be `https://your-deployment.vercel.app/mcp` (the `/mcp` path, not `/sse` or root).

10. **icon.png** — Replace the placeholder icon in `public/icon.png` with an actual Google Ads icon (256x256 PNG).
