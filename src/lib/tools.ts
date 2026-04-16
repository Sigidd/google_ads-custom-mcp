/**
 * Registers all Google Ads MCP tools on the given McpServer instance.
 *
 * Tools (35 total):
 *   Account:       list_accessible_customers, get_account_summary
 *   Campaigns:     list_campaigns, get_campaign, create_campaign, update_campaign,
 *                  pause_campaign, enable_campaign, remove_campaign
 *   Ad Groups:     list_ad_groups, get_ad_group, create_ad_group, update_ad_group,
 *                  pause_ad_group
 *   Ads:           list_ads, create_responsive_search_ad, update_ad
 *   Keywords:      list_keywords, add_keywords, update_keyword, remove_keyword
 *   Budgets:       list_campaign_budgets, create_campaign_budget, update_campaign_budget
 *   Reports:       get_performance_report, get_search_terms_report, get_keyword_report,
 *                  get_geographic_report, get_device_report, execute_gaql_query
 *   Conversions:   list_conversion_actions, create_conversion_action
 *   Recommendations: list_recommendations, apply_recommendation, dismiss_recommendation
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GoogleAdsClient } from "./google-ads";

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
function err(e: unknown): ToolResult {
  const msg = e instanceof Error ? e.message : String(e);
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}

const optStr = z.string().optional();
const optNum = z.number().optional();

const DATE_RANGE_VALUES = [
  "TODAY",
  "YESTERDAY",
  "LAST_7_DAYS",
  "LAST_30_DAYS",
  "THIS_MONTH",
  "LAST_MONTH",
] as const;

export function registerTools(server: McpServer, client: GoogleAdsClient) {
  // ════════════════════════════════════════════════════════════════════════════
  // ACCOUNT TOOLS
  // ════════════════════════════════════════════════════════════════════════════

  server.tool(
    "list_accessible_customers",
    "List all Google Ads accounts accessible to the authenticated user. Returns resourceName, id, descriptiveName, currencyCode, timeZone.",
    {},
    async () => {
      try {
        return ok(await client.listAccessibleCustomers());
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "get_account_summary",
    "Get account overview including impressions, clicks, cost, conversions, CTR, and average CPC.",
    {
      customer_id: z.string().describe("Google Ads customer ID (without dashes)"),
      date_range: z
        .enum(DATE_RANGE_VALUES)
        .optional()
        .describe(
          "Date range: TODAY/YESTERDAY/LAST_7_DAYS/LAST_30_DAYS/THIS_MONTH/LAST_MONTH (default: LAST_30_DAYS)"
        ),
    },
    async ({ customer_id, date_range = "LAST_30_DAYS" }) => {
      try {
        const query = `
          SELECT
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr,
            metrics.average_cpc
          FROM customer
          WHERE segments.date DURING ${date_range}
        `.trim();
        return ok(await client.search(customer_id, query));
      } catch (e) {
        return err(e);
      }
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // CAMPAIGN TOOLS
  // ════════════════════════════════════════════════════════════════════════════

  server.tool(
    "list_campaigns",
    "List campaigns for a customer account.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      status: z
        .enum(["ENABLED", "PAUSED", "REMOVED", "ALL"])
        .optional()
        .describe("Filter by status (default: ENABLED)"),
      date_range: z.enum(DATE_RANGE_VALUES).optional().describe("Date range for metrics"),
      page_size: z.number().int().optional().describe("Max results (default 100)"),
    },
    async ({ customer_id, status = "ENABLED", date_range = "LAST_30_DAYS", page_size = 100 }) => {
      try {
        const statusClause = status === "ALL" ? "" : `AND campaign.status = '${status}'`;
        const query = `
          SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.advertising_channel_type,
            campaign.bidding_strategy_type,
            campaign.start_date,
            campaign.end_date,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions
          FROM campaign
          WHERE segments.date DURING ${date_range}
          ${statusClause}
          ORDER BY metrics.cost_micros DESC
          LIMIT ${page_size}
        `.trim();
        return ok(await client.search(customer_id, query));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "get_campaign",
    "Get details for a specific campaign.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      campaign_id: z.string().describe("Campaign ID"),
    },
    async ({ customer_id, campaign_id }) => {
      try {
        const query = `
          SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.advertising_channel_type,
            campaign.bidding_strategy_type,
            campaign.start_date,
            campaign.end_date,
            campaign.campaign_budget,
            campaign.target_cpa.target_cpa_micros,
            campaign.target_roas.target_roas,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions
          FROM campaign
          WHERE campaign.id = ${campaign_id}
        `.trim();
        return ok(await client.search(customer_id, query));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "create_campaign",
    "Create a new Google Ads campaign.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      name: z.string().describe("Campaign name"),
      advertising_channel_type: z
        .enum(["SEARCH", "DISPLAY", "SHOPPING", "VIDEO", "SMART", "PERFORMANCE_MAX"])
        .describe("Advertising channel type"),
      budget_amount_micros: z
        .number()
        .describe("Daily budget in micros (1,000,000 = $1)"),
      status: z
        .enum(["ENABLED", "PAUSED"])
        .optional()
        .describe("Campaign status (default: ENABLED)"),
      target_cpa_micros: optNum.describe("Target CPA in micros (optional)"),
      target_roas: optNum.describe("Target ROAS as a ratio e.g. 4.0 = 400% (optional)"),
      start_date: optStr.describe("Start date YYYY-MM-DD (optional)"),
      end_date: optStr.describe("End date YYYY-MM-DD (optional)"),
    },
    async ({
      customer_id,
      name,
      advertising_channel_type,
      budget_amount_micros,
      status,
      target_cpa_micros,
      target_roas,
      start_date,
      end_date,
    }) => {
      try {
        // First create a budget
        const budgetResult = await client.mutateCampaignBudgets(customer_id, [
          {
            create: {
              name: `Budget for ${name}`,
              amountMicros: budget_amount_micros.toString(),
              deliveryMethod: "STANDARD",
            },
          },
        ]) as { results?: Array<{ resourceName: string }> };

        const budgetResourceName = budgetResult?.results?.[0]?.resourceName;
        if (!budgetResourceName) {
          throw new Error("Failed to create campaign budget");
        }

        const campaignCreate: Record<string, unknown> = {
          name,
          advertisingChannelType: advertising_channel_type,
          status: status ?? "ENABLED",
          campaignBudget: budgetResourceName,
          containsEuPoliticalAdvertising: false,
        };

        if (start_date) campaignCreate.startDate = start_date.replace(/-/g, "");
        if (end_date) campaignCreate.endDate = end_date.replace(/-/g, "");

        if (target_cpa_micros) {
          campaignCreate.targetCpa = { targetCpaMicros: target_cpa_micros.toString() };
        } else if (target_roas) {
          campaignCreate.targetRoas = { targetRoas: target_roas };
        } else {
          campaignCreate.maximizeConversions = {};
        }

        return ok(
          await client.mutate(customer_id, [
            { campaignOperation: { create: campaignCreate } },
          ])
        );
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "update_campaign",
    "Update an existing campaign (name, status, budget, end date).",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      campaign_id: z.string().describe("Campaign ID"),
      name: optStr.describe("New campaign name (optional)"),
      status: z.enum(["ENABLED", "PAUSED"]).optional().describe("New status (optional)"),
      budget_amount_micros: optNum.describe("New daily budget in micros (optional)"),
      end_date: optStr.describe("New end date YYYY-MM-DD (optional)"),
    },
    async ({ customer_id, campaign_id, name, status, budget_amount_micros, end_date }) => {
      try {
        const resourceName = `customers/${customer_id}/campaigns/${campaign_id}`;
        const update: Record<string, unknown> = { resourceName };
        const updateMask: string[] = [];

        if (name) { update.name = name; updateMask.push("name"); }
        if (status) { update.status = status; updateMask.push("status"); }
        if (end_date) { update.endDate = end_date.replace(/-/g, ""); updateMask.push("end_date"); }

        const ops: unknown[] = [
          { campaignOperation: { update, updateMask: updateMask.join(",") } },
        ];

        // Update budget separately if provided
        if (budget_amount_micros !== undefined) {
          // First get the budget resource name
          const query = `SELECT campaign.campaign_budget FROM campaign WHERE campaign.id = ${campaign_id}`;
          const result = await client.search(customer_id, query) as { results?: Array<{ campaign?: { campaignBudget?: string } }> };
          const budgetRn = result?.results?.[0]?.campaign?.campaignBudget;
          if (budgetRn) {
            await client.mutateCampaignBudgets(customer_id, [
              {
                update: {
                  resourceName: budgetRn,
                  amountMicros: budget_amount_micros.toString(),
                },
                updateMask: "amount_micros",
              },
            ]);
          }
        }

        if (updateMask.length > 0) {
          return ok(await client.mutate(customer_id, ops));
        }
        return ok({ message: "Nothing to update" });
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "pause_campaign",
    "Pause a campaign.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      campaign_id: z.string().describe("Campaign ID"),
    },
    async ({ customer_id, campaign_id }) => {
      try {
        const resourceName = `customers/${customer_id}/campaigns/${campaign_id}`;
        return ok(
          await client.mutate(customer_id, [
            {
              campaignOperation: {
                update: { resourceName, status: "PAUSED" },
                updateMask: "status",
              },
            },
          ])
        );
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "enable_campaign",
    "Enable (resume) a paused campaign.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      campaign_id: z.string().describe("Campaign ID"),
    },
    async ({ customer_id, campaign_id }) => {
      try {
        const resourceName = `customers/${customer_id}/campaigns/${campaign_id}`;
        return ok(
          await client.mutate(customer_id, [
            {
              campaignOperation: {
                update: { resourceName, status: "ENABLED" },
                updateMask: "status",
              },
            },
          ])
        );
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "remove_campaign",
    "Permanently remove a campaign.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      campaign_id: z.string().describe("Campaign ID"),
    },
    async ({ customer_id, campaign_id }) => {
      try {
        const resourceName = `customers/${customer_id}/campaigns/${campaign_id}`;
        return ok(
          await client.mutate(customer_id, [
            { campaignOperation: { remove: resourceName } },
          ])
        );
      } catch (e) {
        return err(e);
      }
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // AD GROUP TOOLS
  // ════════════════════════════════════════════════════════════════════════════

  server.tool(
    "list_ad_groups",
    "List ad groups for a customer, optionally filtered by campaign.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      campaign_id: optStr.describe("Filter by campaign ID (optional)"),
      status: z
        .enum(["ENABLED", "PAUSED", "REMOVED", "ALL"])
        .optional()
        .describe("Filter by status (default: ENABLED)"),
      page_size: z.number().int().optional().describe("Max results (default 100)"),
    },
    async ({ customer_id, campaign_id, status = "ENABLED", page_size = 100 }) => {
      try {
        const statusClause = status === "ALL" ? "" : `AND ad_group.status = '${status}'`;
        const campaignClause = campaign_id
          ? `AND campaign.id = ${campaign_id}`
          : "";
        const query = `
          SELECT
            ad_group.id,
            ad_group.name,
            ad_group.status,
            ad_group.cpc_bid_micros,
            campaign.id,
            campaign.name
          FROM ad_group
          WHERE ad_group.status != 'REMOVED'
          ${statusClause}
          ${campaignClause}
          LIMIT ${page_size}
        `.trim();
        return ok(await client.search(customer_id, query));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "get_ad_group",
    "Get details for a specific ad group.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      ad_group_id: z.string().describe("Ad group ID"),
    },
    async ({ customer_id, ad_group_id }) => {
      try {
        const query = `
          SELECT
            ad_group.id,
            ad_group.name,
            ad_group.status,
            ad_group.cpc_bid_micros,
            ad_group.type,
            campaign.id,
            campaign.name
          FROM ad_group
          WHERE ad_group.id = ${ad_group_id}
        `.trim();
        return ok(await client.search(customer_id, query));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "create_ad_group",
    "Create a new ad group within a campaign.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      campaign_id: z.string().describe("Parent campaign ID"),
      name: z.string().describe("Ad group name"),
      cpc_bid_micros: optNum.describe("CPC bid in micros (optional)"),
      status: z.enum(["ENABLED", "PAUSED"]).optional().describe("Status (default: ENABLED)"),
    },
    async ({ customer_id, campaign_id, name, cpc_bid_micros, status = "ENABLED" }) => {
      try {
        const create: Record<string, unknown> = {
          name,
          status,
          campaign: `customers/${customer_id}/campaigns/${campaign_id}`,
        };
        if (cpc_bid_micros !== undefined) {
          create.cpcBidMicros = cpc_bid_micros.toString();
        }
        return ok(
          await client.mutate(customer_id, [
            { adGroupOperation: { create } },
          ])
        );
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "update_ad_group",
    "Update an existing ad group.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      ad_group_id: z.string().describe("Ad group ID"),
      name: optStr.describe("New name (optional)"),
      cpc_bid_micros: optNum.describe("New CPC bid in micros (optional)"),
      status: z.enum(["ENABLED", "PAUSED"]).optional().describe("New status (optional)"),
    },
    async ({ customer_id, ad_group_id, name, cpc_bid_micros, status }) => {
      try {
        const resourceName = `customers/${customer_id}/adGroups/${ad_group_id}`;
        const update: Record<string, unknown> = { resourceName };
        const updateMask: string[] = [];

        if (name) { update.name = name; updateMask.push("name"); }
        if (status) { update.status = status; updateMask.push("status"); }
        if (cpc_bid_micros !== undefined) {
          update.cpcBidMicros = cpc_bid_micros.toString();
          updateMask.push("cpc_bid_micros");
        }

        if (updateMask.length === 0) return ok({ message: "Nothing to update" });

        return ok(
          await client.mutate(customer_id, [
            { adGroupOperation: { update, updateMask: updateMask.join(",") } },
          ])
        );
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "pause_ad_group",
    "Pause an ad group.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      ad_group_id: z.string().describe("Ad group ID"),
    },
    async ({ customer_id, ad_group_id }) => {
      try {
        const resourceName = `customers/${customer_id}/adGroups/${ad_group_id}`;
        return ok(
          await client.mutate(customer_id, [
            {
              adGroupOperation: {
                update: { resourceName, status: "PAUSED" },
                updateMask: "status",
              },
            },
          ])
        );
      } catch (e) {
        return err(e);
      }
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // AD TOOLS
  // ════════════════════════════════════════════════════════════════════════════

  server.tool(
    "list_ads",
    "List ads, optionally filtered by ad group.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      ad_group_id: optStr.describe("Filter by ad group ID (optional)"),
      status: z
        .enum(["ENABLED", "PAUSED", "REMOVED", "ALL"])
        .optional()
        .describe("Filter by status (default: ENABLED)"),
      page_size: z.number().int().optional().describe("Max results (default 100)"),
    },
    async ({ customer_id, ad_group_id, status = "ENABLED", page_size = 100 }) => {
      try {
        const statusClause = status === "ALL" ? "" : `AND ad_group_ad.status = '${status}'`;
        const agClause = ad_group_id ? `AND ad_group.id = ${ad_group_id}` : "";
        const query = `
          SELECT
            ad_group_ad.ad.id,
            ad_group_ad.ad.type,
            ad_group_ad.ad.final_urls,
            ad_group_ad.ad.responsive_search_ad.headlines,
            ad_group_ad.ad.responsive_search_ad.descriptions,
            ad_group_ad.status,
            ad_group.id,
            ad_group.name,
            campaign.id,
            campaign.name
          FROM ad_group_ad
          WHERE ad_group_ad.status != 'REMOVED'
          ${statusClause}
          ${agClause}
          LIMIT ${page_size}
        `.trim();
        return ok(await client.search(customer_id, query));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "create_responsive_search_ad",
    "Create a Responsive Search Ad (RSA) in an ad group.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      ad_group_id: z.string().describe("Ad group ID"),
      final_urls: z.array(z.string()).describe("Landing page URLs (array)"),
      headlines: z
        .array(z.string())
        .min(3)
        .max(15)
        .describe("Ad headlines (3–15 strings, max 30 chars each)"),
      descriptions: z
        .array(z.string())
        .min(2)
        .max(4)
        .describe("Ad descriptions (2–4 strings, max 90 chars each)"),
      path1: optStr.describe("Display path 1 (optional, max 15 chars)"),
      path2: optStr.describe("Display path 2 (optional, max 15 chars)"),
    },
    async ({
      customer_id,
      ad_group_id,
      final_urls,
      headlines,
      descriptions,
      path1,
      path2,
    }) => {
      try {
        const ad: Record<string, unknown> = {
          finalUrls: final_urls,
          responsiveSearchAd: {
            headlines: headlines.map((text) => ({ text })),
            descriptions: descriptions.map((text) => ({ text })),
          },
        };
        if (path1) (ad.responsiveSearchAd as Record<string, unknown>).path1 = path1;
        if (path2) (ad.responsiveSearchAd as Record<string, unknown>).path2 = path2;

        return ok(
          await client.mutate(customer_id, [
            {
              adGroupAdOperation: {
                create: {
                  adGroup: `customers/${customer_id}/adGroups/${ad_group_id}`,
                  status: "ENABLED",
                  ad,
                },
              },
            },
          ])
        );
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "update_ad",
    "Update the status of an ad (enable, pause, or remove).",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      ad_group_ad_resource_name: z
        .string()
        .describe(
          "Full resource name of the AdGroupAd, e.g. customers/123/adGroupAds/456~789"
        ),
      status: z
        .enum(["ENABLED", "PAUSED", "REMOVED"])
        .describe("New status"),
    },
    async ({ customer_id, ad_group_ad_resource_name, status }) => {
      try {
        return ok(
          await client.mutate(customer_id, [
            {
              adGroupAdOperation: {
                update: { resourceName: ad_group_ad_resource_name, status },
                updateMask: "status",
              },
            },
          ])
        );
      } catch (e) {
        return err(e);
      }
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // KEYWORD TOOLS
  // ════════════════════════════════════════════════════════════════════════════

  server.tool(
    "list_keywords",
    "List keywords, optionally filtered by ad group.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      ad_group_id: optStr.describe("Filter by ad group ID (optional)"),
      status: z
        .enum(["ENABLED", "PAUSED", "REMOVED", "ALL"])
        .optional()
        .describe("Filter by status (default: ENABLED)"),
      page_size: z.number().int().optional().describe("Max results (default 100)"),
    },
    async ({ customer_id, ad_group_id, status = "ENABLED", page_size = 100 }) => {
      try {
        const statusClause = status === "ALL" ? "" : `AND ad_group_criterion.status = '${status}'`;
        const agClause = ad_group_id ? `AND ad_group.id = ${ad_group_id}` : "";
        const query = `
          SELECT
            ad_group_criterion.criterion_id,
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group_criterion.status,
            ad_group_criterion.cpc_bid_micros,
            ad_group_criterion.resource_name,
            ad_group.id,
            ad_group.name,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.ctr,
            metrics.average_cpc
          FROM keyword_view
          WHERE ad_group_criterion.type = 'KEYWORD'
          AND ad_group_criterion.status != 'REMOVED'
          ${statusClause}
          ${agClause}
          LIMIT ${page_size}
        `.trim();
        return ok(await client.search(customer_id, query));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "add_keywords",
    "Add keywords to an ad group.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      ad_group_id: z.string().describe("Ad group ID"),
      keywords: z
        .array(
          z.object({
            text: z.string().describe("Keyword text"),
            match_type: z
              .enum(["BROAD", "PHRASE", "EXACT"])
              .describe("Match type"),
            cpc_bid_micros: optNum.describe("CPC bid in micros (optional)"),
          })
        )
        .describe("Array of keywords to add"),
    },
    async ({ customer_id, ad_group_id, keywords }) => {
      try {
        const operations = keywords.map((kw) => {
          const create: Record<string, unknown> = {
            adGroup: `customers/${customer_id}/adGroups/${ad_group_id}`,
            status: "ENABLED",
            keyword: {
              text: kw.text,
              matchType: kw.match_type,
            },
          };
          if (kw.cpc_bid_micros !== undefined) {
            create.cpcBidMicros = kw.cpc_bid_micros.toString();
          }
          return { adGroupCriterionOperation: { create } };
        });
        return ok(await client.mutate(customer_id, operations));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "update_keyword",
    "Update a keyword's status or CPC bid.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      keyword_resource_name: z
        .string()
        .describe("Full resource name, e.g. customers/123/adGroupCriteria/456~789"),
      status: z
        .enum(["ENABLED", "PAUSED"])
        .optional()
        .describe("New status (optional)"),
      cpc_bid_micros: optNum.describe("New CPC bid in micros (optional)"),
    },
    async ({ customer_id, keyword_resource_name, status, cpc_bid_micros }) => {
      try {
        const update: Record<string, unknown> = { resourceName: keyword_resource_name };
        const updateMask: string[] = [];

        if (status) { update.status = status; updateMask.push("status"); }
        if (cpc_bid_micros !== undefined) {
          update.cpcBidMicros = cpc_bid_micros.toString();
          updateMask.push("cpc_bid_micros");
        }

        if (updateMask.length === 0) return ok({ message: "Nothing to update" });

        return ok(
          await client.mutate(customer_id, [
            {
              adGroupCriterionOperation: {
                update,
                updateMask: updateMask.join(","),
              },
            },
          ])
        );
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "remove_keyword",
    "Remove a keyword from an ad group.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      keyword_resource_name: z
        .string()
        .describe("Full resource name, e.g. customers/123/adGroupCriteria/456~789"),
    },
    async ({ customer_id, keyword_resource_name }) => {
      try {
        return ok(
          await client.mutate(customer_id, [
            { adGroupCriterionOperation: { remove: keyword_resource_name } },
          ])
        );
      } catch (e) {
        return err(e);
      }
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // BUDGET TOOLS
  // ════════════════════════════════════════════════════════════════════════════

  server.tool(
    "list_campaign_budgets",
    "List campaign budgets for a customer.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      page_size: z.number().int().optional().describe("Max results (default 100)"),
    },
    async ({ customer_id, page_size = 100 }) => {
      try {
        const query = `
          SELECT
            campaign_budget.id,
            campaign_budget.name,
            campaign_budget.amount_micros,
            campaign_budget.delivery_method,
            campaign_budget.period,
            campaign_budget.resource_name
          FROM campaign_budget
          WHERE campaign_budget.status = 'ENABLED'
          LIMIT ${page_size}
        `.trim();
        return ok(await client.search(customer_id, query));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "create_campaign_budget",
    "Create a new campaign budget.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      name: z.string().describe("Budget name"),
      amount_micros: z.number().describe("Daily budget amount in micros (1,000,000 = $1)"),
      delivery_method: z
        .enum(["STANDARD", "ACCELERATED"])
        .optional()
        .describe("Delivery method (default: STANDARD)"),
    },
    async ({ customer_id, name, amount_micros, delivery_method = "STANDARD" }) => {
      try {
        return ok(
          await client.mutateCampaignBudgets(customer_id, [
            {
              create: {
                name,
                amountMicros: amount_micros.toString(),
                deliveryMethod: delivery_method,
              },
            },
          ])
        );
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "update_campaign_budget",
    "Update a campaign budget's daily amount.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      budget_resource_name: z
        .string()
        .describe("Budget resource name, e.g. customers/123/campaignBudgets/456"),
      amount_micros: z.number().describe("New daily budget in micros"),
    },
    async ({ customer_id, budget_resource_name, amount_micros }) => {
      try {
        return ok(
          await client.mutateCampaignBudgets(customer_id, [
            {
              update: {
                resourceName: budget_resource_name,
                amountMicros: amount_micros.toString(),
              },
              updateMask: "amount_micros",
            },
          ])
        );
      } catch (e) {
        return err(e);
      }
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // REPORT TOOLS
  // ════════════════════════════════════════════════════════════════════════════

  server.tool(
    "get_performance_report",
    "Get campaign performance metrics for a date range.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      date_range: z.enum(DATE_RANGE_VALUES).describe("Date range for the report"),
      metrics: z
        .array(
          z.enum([
            "impressions",
            "clicks",
            "cost_micros",
            "conversions",
            "ctr",
            "average_cpc",
            "roas",
          ])
        )
        .optional()
        .describe("Metrics to include (default: all)"),
      campaign_id: optStr.describe("Filter by campaign ID (optional)"),
    },
    async ({ customer_id, date_range, metrics, campaign_id }) => {
      try {
        const allMetrics = metrics ?? [
          "impressions",
          "clicks",
          "cost_micros",
          "conversions",
          "ctr",
          "average_cpc",
        ];
        const metricFields = allMetrics.map((m) => `metrics.${m}`).join(",\n            ");
        const campaignClause = campaign_id ? `AND campaign.id = ${campaign_id}` : "";
        const query = `
          SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            ${metricFields}
          FROM campaign
          WHERE segments.date DURING ${date_range}
          ${campaignClause}
          ORDER BY metrics.cost_micros DESC
        `.trim();
        return ok(await client.search(customer_id, query));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "get_search_terms_report",
    "Get search terms performance report.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      date_range: z.enum(DATE_RANGE_VALUES).describe("Date range"),
      campaign_id: optStr.describe("Filter by campaign ID (optional)"),
      page_size: z.number().int().optional().describe("Max results (default 100)"),
    },
    async ({ customer_id, date_range, campaign_id, page_size = 100 }) => {
      try {
        const campaignClause = campaign_id ? `AND campaign.id = ${campaign_id}` : "";
        const query = `
          SELECT
            search_term_view.search_term,
            search_term_view.status,
            campaign.id,
            campaign.name,
            ad_group.name,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr,
            metrics.average_cpc
          FROM search_term_view
          WHERE segments.date DURING ${date_range}
          ${campaignClause}
          ORDER BY metrics.cost_micros DESC
          LIMIT ${page_size}
        `.trim();
        return ok(await client.search(customer_id, query));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "get_keyword_report",
    "Get keyword performance report.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      date_range: z.enum(DATE_RANGE_VALUES).describe("Date range"),
      campaign_id: optStr.describe("Filter by campaign ID (optional)"),
      ad_group_id: optStr.describe("Filter by ad group ID (optional)"),
      page_size: z.number().int().optional().describe("Max results (default 100)"),
    },
    async ({ customer_id, date_range, campaign_id, ad_group_id, page_size = 100 }) => {
      try {
        const campaignClause = campaign_id ? `AND campaign.id = ${campaign_id}` : "";
        const agClause = ad_group_id ? `AND ad_group.id = ${ad_group_id}` : "";
        const query = `
          SELECT
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group_criterion.status,
            campaign.name,
            ad_group.name,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr,
            metrics.average_cpc,
            metrics.average_cpm
          FROM keyword_view
          WHERE segments.date DURING ${date_range}
          AND ad_group_criterion.type = 'KEYWORD'
          ${campaignClause}
          ${agClause}
          ORDER BY metrics.cost_micros DESC
          LIMIT ${page_size}
        `.trim();
        return ok(await client.search(customer_id, query));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "get_geographic_report",
    "Get geographic performance report by country/region.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      date_range: z.enum(DATE_RANGE_VALUES).describe("Date range"),
      campaign_id: optStr.describe("Filter by campaign ID (optional)"),
      page_size: z.number().int().optional().describe("Max results (default 100)"),
    },
    async ({ customer_id, date_range, campaign_id, page_size = 100 }) => {
      try {
        const campaignClause = campaign_id ? `AND campaign.id = ${campaign_id}` : "";
        const query = `
          SELECT
            geographic_view.country_criterion_id,
            geographic_view.location_type,
            campaign.name,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr
          FROM geographic_view
          WHERE segments.date DURING ${date_range}
          ${campaignClause}
          ORDER BY metrics.cost_micros DESC
          LIMIT ${page_size}
        `.trim();
        return ok(await client.search(customer_id, query));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "get_device_report",
    "Get performance breakdown by device (mobile, desktop, tablet).",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      date_range: z.enum(DATE_RANGE_VALUES).describe("Date range"),
      campaign_id: optStr.describe("Filter by campaign ID (optional)"),
    },
    async ({ customer_id, date_range, campaign_id }) => {
      try {
        const campaignClause = campaign_id ? `AND campaign.id = ${campaign_id}` : "";
        const query = `
          SELECT
            segments.device,
            campaign.name,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr,
            metrics.average_cpc
          FROM campaign
          WHERE segments.date DURING ${date_range}
          ${campaignClause}
          ORDER BY segments.device ASC
        `.trim();
        return ok(await client.search(customer_id, query));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "execute_gaql_query",
    "Execute any arbitrary GAQL (Google Ads Query Language) query. Power user tool for custom reports.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      query: z
        .string()
        .describe(
          "GAQL query string, e.g. SELECT campaign.name, metrics.clicks FROM campaign WHERE segments.date DURING LAST_7_DAYS"
        ),
      page_size: z.number().int().optional().describe("Max results (default 1000)"),
    },
    async ({ customer_id, query, page_size = 1000 }) => {
      try {
        return ok(await client.search(customer_id, query, page_size));
      } catch (e) {
        return err(e);
      }
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // CONVERSION TOOLS
  // ════════════════════════════════════════════════════════════════════════════

  server.tool(
    "list_conversion_actions",
    "List conversion actions for a customer.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      status: z
        .enum(["ENABLED", "REMOVED", "ALL"])
        .optional()
        .describe("Filter by status (default: ENABLED)"),
    },
    async ({ customer_id, status = "ENABLED" }) => {
      try {
        const statusClause = status === "ALL" ? "" : `AND conversion_action.status = '${status}'`;
        const query = `
          SELECT
            conversion_action.id,
            conversion_action.name,
            conversion_action.type,
            conversion_action.category,
            conversion_action.status,
            conversion_action.value_settings.default_value,
            conversion_action.value_settings.always_use_default_value
          FROM conversion_action
          WHERE conversion_action.status != 'REMOVED'
          ${statusClause}
        `.trim();
        return ok(await client.search(customer_id, query));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "create_conversion_action",
    "Create a new conversion action.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      name: z.string().describe("Conversion action name"),
      type: z
        .string()
        .describe(
          "Conversion type: WEBPAGE, PHONE_CALL, APP_INSTALL, IMPORT, STORE_VISIT, etc."
        ),
      category: z
        .string()
        .describe(
          "Conversion category: PURCHASE, LEAD, SIGNUP, CONTACT, DOWNLOAD, etc."
        ),
      value_settings: z
        .object({
          default_value: z.number().optional(),
          always_use_default_value: z.boolean().optional(),
        })
        .optional()
        .describe("Value settings (optional)"),
    },
    async ({ customer_id, name, type, category, value_settings }) => {
      try {
        const create: Record<string, unknown> = {
          name,
          type,
          category,
          status: "ENABLED",
        };
        if (value_settings) {
          create.valueSettings = {
            defaultValue: value_settings.default_value ?? 0,
            alwaysUseDefaultValue: value_settings.always_use_default_value ?? false,
          };
        }
        return ok(
          await client.mutate(customer_id, [
            { conversionActionOperation: { create } },
          ])
        );
      } catch (e) {
        return err(e);
      }
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // RECOMMENDATION TOOLS
  // ════════════════════════════════════════════════════════════════════════════

  server.tool(
    "list_recommendations",
    "List optimization recommendations for a customer.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      types: z
        .array(z.string())
        .optional()
        .describe(
          "Filter by recommendation types, e.g. ['KEYWORD', 'BID', 'AD', 'CALLOUT_EXTENSION'] (optional — omit for all)"
        ),
    },
    async ({ customer_id, types }) => {
      try {
        const typeClause =
          types && types.length > 0
            ? `AND recommendation.type IN (${types.map((t) => `'${t}'`).join(", ")})`
            : "";
        const query = `
          SELECT
            recommendation.resource_name,
            recommendation.type,
            recommendation.impact.base_metrics.impressions,
            recommendation.impact.potential_metrics.impressions,
            recommendation.campaign
          FROM recommendation
          WHERE recommendation.dismissed = FALSE
          ${typeClause}
        `.trim();
        return ok(await client.search(customer_id, query));
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "apply_recommendation",
    "Apply an optimization recommendation.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      recommendation_resource_name: z
        .string()
        .describe(
          "Recommendation resource name, e.g. customers/123/recommendations/abc123"
        ),
    },
    async ({ customer_id, recommendation_resource_name }) => {
      try {
        return ok(
          await client.applyRecommendation(customer_id, [
            { resourceName: recommendation_resource_name },
          ])
        );
      } catch (e) {
        return err(e);
      }
    }
  );

  server.tool(
    "dismiss_recommendation",
    "Dismiss an optimization recommendation.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      recommendation_resource_name: z
        .string()
        .describe(
          "Recommendation resource name, e.g. customers/123/recommendations/abc123"
        ),
    },
    async ({ customer_id, recommendation_resource_name }) => {
      try {
        return ok(
          await client.dismissRecommendation(customer_id, [
            { resourceName: recommendation_resource_name },
          ])
        );
      } catch (e) {
        return err(e);
      }
    }
  );
}
