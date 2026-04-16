/**
 * Homepage — lists available tools and shows connection instructions.
 */

const tools = [
  // Account
  { name: "list_accessible_customers", description: "List all Google Ads accounts accessible to the authenticated user" },
  { name: "get_account_summary", description: "Get account overview: impressions, clicks, cost, conversions, CTR, avg CPC" },
  // Campaigns
  { name: "list_campaigns", description: "List campaigns with optional status filter and metrics" },
  { name: "get_campaign", description: "Get details for a specific campaign" },
  { name: "create_campaign", description: "Create a new campaign with budget and bidding strategy" },
  { name: "update_campaign", description: "Update campaign name, status, budget, or end date" },
  { name: "pause_campaign", description: "Pause a campaign" },
  { name: "enable_campaign", description: "Enable (resume) a paused campaign" },
  { name: "remove_campaign", description: "Permanently remove a campaign" },
  // Ad Groups
  { name: "list_ad_groups", description: "List ad groups, optionally filtered by campaign" },
  { name: "get_ad_group", description: "Get details for a specific ad group" },
  { name: "create_ad_group", description: "Create a new ad group within a campaign" },
  { name: "update_ad_group", description: "Update ad group name, status, or CPC bid" },
  { name: "pause_ad_group", description: "Pause an ad group" },
  // Ads
  { name: "list_ads", description: "List ads, optionally filtered by ad group" },
  { name: "create_responsive_search_ad", description: "Create a Responsive Search Ad (RSA) with headlines and descriptions" },
  { name: "update_ad", description: "Update ad status (enable, pause, or remove)" },
  // Keywords
  { name: "list_keywords", description: "List keywords with performance metrics" },
  { name: "add_keywords", description: "Add keywords (BROAD/PHRASE/EXACT) to an ad group" },
  { name: "update_keyword", description: "Update keyword status or CPC bid" },
  { name: "remove_keyword", description: "Remove a keyword from an ad group" },
  // Budgets
  { name: "list_campaign_budgets", description: "List all campaign budgets" },
  { name: "create_campaign_budget", description: "Create a new campaign budget" },
  { name: "update_campaign_budget", description: "Update campaign budget daily amount" },
  // Reports
  { name: "get_performance_report", description: "Campaign performance metrics for a date range" },
  { name: "get_search_terms_report", description: "Search terms performance — what users actually searched" },
  { name: "get_keyword_report", description: "Keyword performance with full metrics" },
  { name: "get_geographic_report", description: "Performance breakdown by geographic location" },
  { name: "get_device_report", description: "Performance breakdown by device (mobile/desktop/tablet)" },
  { name: "execute_gaql_query", description: "Execute any GAQL query — power user tool for custom reports" },
  // Conversions
  { name: "list_conversion_actions", description: "List conversion actions and their settings" },
  { name: "create_conversion_action", description: "Create a new conversion action" },
  // Recommendations
  { name: "list_recommendations", description: "List optimization recommendations from Google Ads" },
  { name: "apply_recommendation", description: "Apply an optimization recommendation" },
  { name: "dismiss_recommendation", description: "Dismiss an optimization recommendation" },
];

const ACCENT = "#4285F4"; // Google blue

export default function HomePage() {
  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 820,
        margin: "0 auto",
        padding: "2rem 1rem",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon.png"
          alt="Google Ads MCP"
          width={64}
          height={64}
          style={{ borderRadius: 12 }}
        />
        <div>
          <h1 style={{ margin: 0, fontSize: "1.8rem" }}>Google Ads MCP</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#666" }}>
            Connect Claude to your Google Ads account — manage campaigns, keywords, and analytics
          </p>
        </div>
      </div>

      {/* Quick Install */}
      <section
        style={{
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: 8,
          padding: "1rem 1.25rem",
          marginBottom: "2rem",
        }}
      >
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem", color: "#0369a1" }}>
          Quick Install
        </h2>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>
          Add this MCP server to Claude using the URL below:
        </p>
        <code
          style={{
            display: "block",
            background: "#e0f2fe",
            padding: "0.5rem 0.75rem",
            borderRadius: 6,
            fontFamily: "monospace",
            fontSize: "0.9rem",
            wordBreak: "break-all",
          }}
        >
          https://your-deployment.vercel.app/mcp
        </code>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#0369a1" }}>
          The connector URL must end with <strong>/mcp</strong>
        </p>
      </section>

      {/* How it works */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "0.75rem" }}>
          How it works
        </h2>
        <ol
          style={{ paddingLeft: "1.25rem", lineHeight: 1.7, color: "#374151" }}
        >
          <li>Add the MCP server URL to Claude</li>
          <li>Claude triggers the OAuth 2.1 flow — you are redirected to a connection page</li>
          <li>Click &quot;Connect with Google Ads&quot; and sign in with your Google account</li>
          <li>Grant Google Ads API access — Claude can now manage your campaigns</li>
          <li>Future sessions use silent re-auth (no re-login needed for 30 days)</li>
        </ol>
      </section>

      {/* Tools list */}
      <section>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "0.75rem" }}>
          Available Tools ({tools.length})
        </h2>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {tools.map((tool) => (
            <div
              key={tool.name}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                padding: "0.6rem 0.75rem",
                background: "#f9fafb",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
              }}
            >
              <code
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                  color: ACCENT,
                  flexShrink: 0,
                  minWidth: 280,
                }}
              >
                {tool.name}
              </code>
              <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                {tool.description}
              </span>
            </div>
          ))}
        </div>
      </section>

      <footer
        style={{
          marginTop: "3rem",
          paddingTop: "1rem",
          borderTop: "1px solid #e5e7eb",
          fontSize: "0.8rem",
          color: "#9ca3af",
        }}
      >
        <p>
          Powered by the{" "}
          <a
            href="https://modelcontextprotocol.io"
            style={{ color: ACCENT }}
          >
            Model Context Protocol
          </a>{" "}
          and{" "}
          <a href="https://vercel.com" style={{ color: ACCENT }}>
            Vercel
          </a>
        </p>
      </footer>
    </main>
  );
}
