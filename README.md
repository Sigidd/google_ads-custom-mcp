# Google Ads MCP

Connect Claude to Google Ads — manage campaigns, ad groups, keywords, budgets, and analytics via natural language.

**MCP endpoint:** `https://googleads-custom-mcp.vercel.app/mcp`  
**Connect page:** `https://googleads-custom-mcp.vercel.app/connect`  
**GitHub:** `https://github.com/Sigidd/google_ads-custom-mcp`

---

## Quick Start (adding the connector)

1. Open Claude Desktop → Settings → Connectors → Add connector
2. Paste: `https://googleads-custom-mcp.vercel.app/mcp`
3. Click **Connect** — you'll be redirected to the Google sign-in
4. If Google shows a warning **"App not verified"** → click **Advanced → Go to Google Ads MCP (unsafe)**
5. Grant permissions → done. Claude now has access to your Google Ads account.

> The "not verified" warning is normal for internal tools. It does not affect security or functionality.

---

## Authentication flow

```
Claude Desktop
  │
  ├─ OAuth 2.1 + PKCE ──► /api/oauth/authorize
  │                              │
  │                        /connect page
  │                              │
  │                   /api/auth/google/start
  │                              │
  │                   Google OAuth 2.0 consent
  │                              │
  │                   /api/auth/google/callback
  │                    (stores tokens in Supabase)
  │                              │
  │◄─── Bearer token ────────────┘
  │
  └─ Tool call ──► /mcp ──► GoogleAdsClient ──► Google Ads REST API v18
```

- **Outer layer**: OAuth 2.1 + PKCE (Claude ↔ this server)
- **Inner layer**: Google OAuth 2.0 with `offline` access (this server ↔ Google Ads)
- **Per-user auth**: each user signs in with their own Google account; access is scoped to what their Google account can see
- **Token auto-refresh**: Google access tokens expire in 1 hour — the server auto-refreshes silently using the stored refresh token
- **Silent re-auth**: `mcp_user_id` cookie (1 year) skips the consent page on future sessions

---

## Tools (35 total)

| Category | Tools |
|---|---|
| **Account** | `list_accessible_customers`, `get_account_summary` |
| **Campaigns** | `list_campaigns`, `get_campaign`, `create_campaign`, `update_campaign`, `pause_campaign`, `enable_campaign`, `remove_campaign` |
| **Ad Groups** | `list_ad_groups`, `get_ad_group`, `create_ad_group`, `update_ad_group`, `pause_ad_group` |
| **Ads** | `list_ads`, `create_responsive_search_ad`, `update_ad` |
| **Keywords** | `list_keywords`, `add_keywords`, `update_keyword`, `remove_keyword` |
| **Budgets** | `list_campaign_budgets`, `create_campaign_budget`, `update_campaign_budget` |
| **Reports** | `get_performance_report`, `get_search_terms_report`, `get_keyword_report`, `get_geographic_report`, `get_device_report`, `execute_gaql_query` |
| **Conversions** | `list_conversion_actions`, `create_conversion_action` |
| **Recommendations** | `list_recommendations`, `apply_recommendation`, `dismiss_recommendation` |

---

## Infrastructure

| Component | Details |
|---|---|
| **Runtime** | Next.js 16 on Vercel (serverless) |
| **MCP adapter** | `@vercel/mcp-adapter` |
| **Database** | Supabase (project: `google-ads-custom-mcp`, region: `eu-west-1`) |
| **Google API** | Google Ads REST API v18 |
| **Google Cloud project** | `ordinal-quarter-493509-q3` |

### Supabase tables

| Table | Purpose |
|---|---|
| `mcp_credentials` | Google access + refresh tokens per user (keyed by SHA256 of Google `sub`) |
| `mcp_oauth_sessions` | In-flight OAuth 2.1 sessions (10 min TTL) |
| `mcp_auth_codes` | Authorization codes pending token exchange (5 min TTL) |
| `mcp_access_tokens` | Bearer token hashes → userId (30 day TTL) |
| `mcp_oauth_clients` | Dynamically registered MCP clients |
| `google_oauth_state` | Google OAuth state → sessionId mapping (10 min TTL) |

---

## Environment variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_BASE_URL` | `https://googleads-custom-mcp.vercel.app` |
| `SUPABASE_URL` | Supabase project URL (`https://sdlnuzoflnvzrfigdwyh.supabase.co`) |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID (project `ordinal-quarter-493509-q3`) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads developer token (from Manager account "Aladia ads") |

---

## Google Cloud setup (for re-configuration)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select project **`ordinal-quarter-493509-q3`** (name: `google-ads-custom-mcp`)
3. **APIs & Services → OAuth consent screen**
   - Status: External, In production
   - Scopes: `adwords`, `userinfo.email`
4. **APIs & Services → Credentials**
   - OAuth 2.0 client: Web application
   - Authorized redirect URI: `https://googleads-custom-mcp.vercel.app/api/auth/google/callback`

### Google Ads Developer Token
- Account: Manager account **"Aladia ads"**
- Location: Google Ads → Admin → API Center

---

## Local development

```bash
npm install
# Copy env vars from Vercel
npx vercel env pull .env.local
npm run dev
# Open http://localhost:3000
```

> ⚠️ Do NOT create a `middleware.ts` file — it breaks MCP handler routing.

---

## Deploy

```bash
# Preview
npx vercel

# Production
npx vercel --prod
```

---

## Key files

| File | Purpose |
|---|---|
| `src/app/[transport]/route.ts` | MCP endpoint (SSE + HTTP), auth gate |
| `src/lib/tools.ts` | All 35 MCP tool definitions |
| `src/lib/google-ads.ts` | Google Ads REST client with auto token refresh |
| `src/lib/store.ts` | Supabase persistence layer |
| `src/lib/auth.ts` | Token generation, PKCE, bearer helpers |
| `src/app/connect/page.tsx` | Connect page |
| `src/app/api/auth/google/start/route.ts` | Initiates Google OAuth redirect |
| `src/app/api/auth/google/callback/route.ts` | Handles Google OAuth callback |
| `src/app/api/oauth/authorize/route.ts` | MCP OAuth 2.1 + silent re-auth |
| `src/app/api/oauth/token/route.ts` | MCP token exchange |
