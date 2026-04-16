/**
 * Google Ads REST API client (v18).
 *
 * Handles:
 * - Auto-refresh of access tokens (if expiry < 5 min)
 * - GAQL search queries
 * - Mutate operations
 * - All resource-specific endpoints
 */
import { store } from "./store";

const GOOGLE_ADS_API_BASE = "https://googleads.googleapis.com/v21";

export class GoogleAdsClient {
  constructor(private userId: string) {}

  private async getToken(): Promise<string> {
    const creds = await store.getCredentials(this.userId);
    if (!creds) {
      throw new Error(
        "Not connected. Please reconnect via the /connect flow."
      );
    }

    // Auto-refresh if expires within 5 minutes
    if (creds.tokenExpiresAt - 5 * 60 * 1000 < Date.now()) {
      const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: creds.googleRefreshToken,
          grant_type: "refresh_token",
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => "(no body)");
        throw new Error(
          `Token refresh failed. Please reconnect. (${resp.status}: ${errText})`
        );
      }
      const data = await resp.json();
      const updated = {
        ...creds,
        googleAccessToken: data.access_token,
        tokenExpiresAt: Date.now() + data.expires_in * 1000,
      };
      await store.setCredentials(this.userId, updated);
      return updated.googleAccessToken;
    }
    return creds.googleAccessToken;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    loginCustomerId?: string
  ): Promise<T> {
    const token = await this.getToken();
    const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "developer-token": DEVELOPER_TOKEN,
      "Content-Type": "application/json",
    };
    if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

    const res = await fetch(`${GOOGLE_ADS_API_BASE}/${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "(no body)");
      throw new Error(`Google Ads API ${method} ${path} → ${res.status}: ${text}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  }

  // ── Core search (GAQL) ────────────────────────────────────────────────────

  async search(
    customerId: string,
    query: string,
    pageSize = 1000,
    loginCustomerId?: string
  ) {
    return this.request(
      "POST",
      `customers/${customerId}/googleAds:search`,
      { query },
      loginCustomerId
    );
  }

  // ── Core mutate ───────────────────────────────────────────────────────────

  async mutate(
    customerId: string,
    mutateOperations: unknown[],
    loginCustomerId?: string
  ) {
    return this.request(
      "POST",
      `customers/${customerId}/googleAds:mutate`,
      { mutateOperations },
      loginCustomerId
    );
  }

  // ── Account operations ────────────────────────────────────────────────────

  async listAccessibleCustomers() {
    return this.request("GET", "customers:listAccessibleCustomers");
  }

  async getCustomer(customerId: string) {
    return this.request("GET", `customers/${customerId}`);
  }

  // ── Budget operations ─────────────────────────────────────────────────────

  async mutateCampaignBudgets(
    customerId: string,
    operations: unknown[],
    loginCustomerId?: string
  ) {
    return this.request(
      "POST",
      `customers/${customerId}/campaignBudgets:mutate`,
      { operations },
      loginCustomerId
    );
  }

  // ── Recommendation operations ─────────────────────────────────────────────

  async applyRecommendation(customerId: string, operations: unknown[]) {
    return this.request(
      "POST",
      `customers/${customerId}/recommendations:apply`,
      { operations }
    );
  }

  async dismissRecommendation(customerId: string, operations: unknown[]) {
    return this.request(
      "POST",
      `customers/${customerId}/recommendations:dismiss`,
      { operations }
    );
  }
}
