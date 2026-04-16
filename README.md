# Google Ads MCP

Connect Claude to Google Ads - manage campaigns, ad groups, keywords, and analytics via natural language.

**MCP endpoint:** https://your-deployment.vercel.app/mcp

## Quick Start

1. Deploy to Vercel (see below)
2. Set environment variables
3. Add connector in Claude: https://your-deployment.vercel.app/mcp
4. Sign in with Google - Claude can now manage your Google Ads

## Tools (35)

| Category | Tools |
|---|---|
| Account | list_accessible_customers, get_account_summary |
| Campaigns | list_campaigns, get_campaign, create_campaign, update_campaign, pause_campaign, enable_campaign, remove_campaign |
| Ad Groups | list_ad_groups, get_ad_group, create_ad_group, update_ad_group, pause_ad_group |
| Ads | list_ads, create_responsive_search_ad, update_ad |
| Keywords | list_keywords, add_keywords, update_keyword, remove_keyword |
| Budgets | list_campaign_budgets, create_campaign_budget, update_campaign_budget |
| Reports | get_performance_report, get_search_terms_report, get_keyword_report, get_geographic_report, get_device_report, execute_gaql_query |
| Conversions | list_conversion_actions, create_conversion_action |
| Recommendations | list_recommendations, apply_recommendation, dismiss_recommendation |

## Environment Variables

| Variable | Description |
|---|---|
| NEXT_PUBLIC_BASE_URL | Public deployment URL |
| SUPABASE_URL | Supabase project URL |
| SUPABASE_ANON_KEY | Supabase anon key |
| GOOGLE_CLIENT_ID | Google OAuth 2.0 client ID |
| GOOGLE_CLIENT_SECRET | Google OAuth 2.0 client secret |
| GOOGLE_ADS_DEVELOPER_TOKEN | Google Ads developer token |

## Local Development

npm install && npm run dev

## Architecture

Claude → OAuth 2.1 + PKCE → /api/oauth/authorize → /connect → Google OAuth 2.0 → /api/auth/google/callback → Bearer token → /mcp → GoogleAdsClient → Google Ads REST API v18
