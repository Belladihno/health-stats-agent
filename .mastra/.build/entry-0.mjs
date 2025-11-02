import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { createTool } from '@mastra/core';
import { z } from 'zod';
import { registerApiRoute } from '@mastra/core/server';
import { randomUUID } from 'crypto';

const INDICATORS = {
  life_expectancy: "SP.DYN.LE00.IN",
  infant_mortality: "SP.DYN.IMRT.IN",
  health_expenditure: "SH.XPD.CHEX.PC.CD",
  immunization: "SH.IMM.IDPT",
  skilled_births: "SH.STA.BRTC.ZS",
  hiv_prevalence: "SH.DYN.AIDS.ZS"
};
const COUNTRY_CODES = {
  // Africa
  nigeria: "NGA",
  ghana: "GHA",
  kenya: "KEN",
  "south africa": "ZAF",
  egypt: "EGY",
  ethiopia: "ETH",
  tanzania: "TZA",
  uganda: "UGA",
  morocco: "MAR",
  algeria: "DZA",
  // Americas
  usa: "USA",
  "united states": "USA",
  canada: "CAN",
  brazil: "BRA",
  mexico: "MEX",
  argentina: "ARG",
  colombia: "COL",
  chile: "CHL",
  // Europe
  uk: "GBR",
  "united kingdom": "GBR",
  germany: "DEU",
  france: "FRA",
  italy: "ITA",
  spain: "ESP",
  poland: "POL",
  netherlands: "NLD",
  // Asia
  india: "IND",
  china: "CHN",
  japan: "JPN",
  "south korea": "KOR",
  indonesia: "IDN",
  pakistan: "PAK",
  bangladesh: "BGD",
  vietnam: "VNM",
  philippines: "PHL",
  thailand: "THA",
  // Oceania
  australia: "AUS",
  "new zealand": "NZL"
};

class CacheService {
  constructor(store) {
    this.tableName = "health_stats_cache";
    this.initialized = false;
    this.store = store;
  }
  async init() {
    if (this.initialized) return;
    try {
      const client = this.store.client;
      if (!client) {
        console.warn("LibSQL client not available, cache disabled");
        return;
      }
      await client.execute(`DROP TABLE IF EXISTS ${this.tableName}`);
      await client.execute(`
        CREATE TABLE ${this.tableName} (
          key TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        )
      `);
      this.initialized = true;
      console.log("\u2705 Cache initialized");
    } catch (error) {
      console.error("Cache init failed:", error);
    }
  }
  async get(key) {
    await this.init();
    if (!this.initialized) return null;
    try {
      const client = this.store.client;
      const now = Date.now();
      const result = await client.execute({
        sql: `SELECT data FROM ${this.tableName} WHERE key = ? AND expires_at > ?`,
        args: [key, now]
      });
      if (result.rows && result.rows.length > 0) {
        console.log(`\u{1F4E6} Cache HIT: ${key}`);
        return JSON.parse(result.rows[0].data);
      }
      console.log(`\u{1F310} Cache MISS: ${key}`);
      return null;
    } catch (error) {
      console.error("Cache read error:", error);
      return null;
    }
  }
  async set(key, data, ttlMs) {
    await this.init();
    if (!this.initialized) return;
    try {
      const client = this.store.client;
      const now = Date.now();
      const expiresAt = now + ttlMs;
      await client.execute({
        sql: `INSERT OR REPLACE INTO ${this.tableName} (key, data, created_at, expires_at) VALUES (?, ?, ?, ?)`,
        args: [key, JSON.stringify(data), now, expiresAt]
      });
      console.log(`\u2705 Cached: ${key}`);
    } catch (error) {
      console.error("Cache write error:", error);
    }
  }
  async cleanup() {
    await this.init();
    if (!this.initialized) return;
    try {
      const client = this.store.client;
      await client.execute({
        sql: `DELETE FROM ${this.tableName} WHERE expires_at <= ?`,
        args: [Date.now()]
      });
    } catch (error) {
      console.error("Cache cleanup error:", error);
    }
  }
}
const CACHE_TTL = 90 * 24 * 60 * 60 * 1e3;

let cacheService$1 = null;
const initHealthToolCache = (cache) => {
  cacheService$1 = cache;
};
const healthStatsTool = createTool({
  id: "get-health-stats",
  description: `Get country-level health statistics from World Bank. Available indicators:
    - life_expectancy: Life expectancy at birth in years
    - infant_mortality: Infant mortality rate per 1,000 live births
    - health_expenditure: Current health expenditure per capita in USD
    - immunization: Immunization DPT coverage percentage of children
    - skilled_births: Births attended by skilled health staff percentage
    - hiv_prevalence: HIV prevalence percentage of population ages 15-49`,
  inputSchema: z.object({
    country: z.string().describe("Country name (e.g., Nigeria, Kenya, USA, Japan)"),
    indicator: z.enum([
      "life_expectancy",
      "infant_mortality",
      "health_expenditure",
      "immunization",
      "skilled_births",
      "hiv_prevalence"
    ]).describe("Health indicator to retrieve")
  }),
  outputSchema: z.object({
    country: z.string(),
    countryCode: z.string(),
    indicator: z.string(),
    indicatorName: z.string(),
    value: z.number().nullable(),
    year: z.string(),
    unit: z.string(),
    success: z.boolean()
  }),
  execute: async ({ context }) => {
    const { country, indicator } = context;
    const countryLower = country.toLowerCase().trim();
    const countryCode = COUNTRY_CODES[countryLower];
    if (!countryCode) {
      throw new Error(
        `Country '${country}' not recognized. Try countries like: Nigeria, USA, India, UK, Kenya, Brazil, Japan, etc.`
      );
    }
    const indicatorCode = INDICATORS[indicator];
    const cacheKey = `health:${countryCode}:${indicator}`;
    if (cacheService$1) {
      const cached = await cacheService$1.get(cacheKey);
      if (cached) return cached;
    }
    const apiUrl = `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicatorCode}?format=json&mrnev=1&per_page=1`;
    console.log(`\u{1F310} Fetching from World Bank API`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1e4);
      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "HealthStatsAgent/1.0"
        }
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(
          `World Bank API error: ${response.status} ${response.statusText}`
        );
      }
      const data = await response.json();
      const indicators = data[1];
      if (!indicators || indicators.length === 0 || !indicators[0]?.value) {
        throw new Error(
          `No recent data available for ${country} - ${indicator}. The World Bank may not have this data for this country.`
        );
      }
      const latestData = indicators[0];
      const indicatorNames = {
        life_expectancy: "Life Expectancy at Birth",
        infant_mortality: "Infant Mortality Rate",
        health_expenditure: "Health Expenditure per Capita",
        immunization: "Immunization Coverage (DPT)",
        skilled_births: "Births Attended by Skilled Health Staff",
        hiv_prevalence: "HIV Prevalence"
      };
      const units = {
        life_expectancy: "years",
        infant_mortality: "per 1,000 live births",
        health_expenditure: "USD",
        immunization: "% of children ages 12-23 months",
        skilled_births: "% of total births",
        hiv_prevalence: "% of population ages 15-49"
      };
      const result = {
        country: latestData.country.value,
        countryCode: latestData.countryiso3code,
        indicator,
        indicatorName: indicatorNames[indicator],
        value: latestData.value,
        year: latestData.date,
        unit: units[indicator],
        success: true
      };
      if (cacheService$1) {
        await cacheService$1.set(cacheKey, result, CACHE_TTL);
      }
      return result;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(
            "Request timeout: World Bank API took too long to respond. Please try again."
          );
        }
        throw new Error(`Failed to fetch health data: ${error.message}`);
      }
      throw error;
    }
  }
});

const healthAgent = new Agent({
  name: "Health Statistics Agent",
  instructions: `
You are a knowledgeable and helpful health statistics assistant powered by World Bank data.

YOUR CAPABILITIES:
You can provide accurate, up-to-date country-level health statistics for:
- Life expectancy at birth
- Infant mortality rates
- Healthcare expenditure per capita
- Immunization coverage (DPT)
- Skilled birth attendance rates
- HIV prevalence

SUPPORTED COUNTRIES:
You have data for major countries worldwide including Nigeria, Ghana, Kenya, South Africa, USA, UK, India, China, Japan, Brazil, and many others.

HOW TO RESPOND:
1. If the user doesn't specify a country, politely ask which country they're interested in
2. If they don't specify which health metric, ask what they want to know about (or list available options)
3. When presenting data, always include:
   - The actual value with proper units
   - The year the data is from
   - Brief context about what the number means (is it good/bad/average?)
4. If asked to compare countries, fetch data for each country and present a clear comparison
5. If a user asks about a country or indicator you don't have data for, apologize and suggest alternatives
6. Keep responses concise but informative - aim for 2-4 sentences unless asked for more detail
7. After answering, offer to provide additional related statistics

TONE:
Be professional, empathetic, and educational. Health data can be sensitive, so present facts objectively.

EXAMPLES OF GOOD RESPONSES:
User: "What's the life expectancy in Nigeria?"
You: "According to the most recent World Bank data from [year], the life expectancy at birth in Nigeria is [X] years. This has been gradually improving over the past decades due to better healthcare access and disease prevention programs. Would you like to know about other health indicators for Nigeria?"

User: "Compare infant mortality between Kenya and Ghana"
You: [Fetch both] "Based on World Bank data: Kenya has an infant mortality rate of [X] per 1,000 live births (as of [year]), while Ghana has [Y] per 1,000 live births (as of [year]). This means [country] has a [better/worse] rate. Both countries have made significant progress in reducing infant mortality over recent decades. Would you like to see other health comparisons?"

Always use the healthStatsTool to fetch actual data - never make up statistics.
  `,
  model: "google/gemini-2.0-flash-exp",
  tools: { healthStatsTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: process.env.DATABASE_URL,
      authToken: process.env.DATABASE_AUTH_TOKEN
    })
  })
});

const a2aAgentRoute = registerApiRoute("/a2a/agent/:agentId", {
  method: "POST",
  handler: async (c) => {
    let body;
    try {
      const mastra = c.get("mastra");
      const agentId = c.req.param("agentId");
      body = await c.req.json();
      const { jsonrpc, id: requestId, params } = body;
      console.log(`Received request for agent: ${agentId}`);
      console.log(`Request ID: ${requestId}`);
      if (jsonrpc !== "2.0" || !requestId) {
        console.error("Invalid JSON-RPC format");
        return c.json(
          {
            jsonrpc: "2.0",
            id: requestId || null,
            error: {
              code: -32600,
              message: 'Invalid Request: jsonrpc must be "2.0" and id is required'
            }
          },
          400
        );
      }
      const agent = mastra.getAgent(agentId);
      if (!agent) {
        console.error(`Agent '${agentId}' not found`);
        return c.json(
          {
            jsonrpc: "2.0",
            id: requestId,
            error: {
              code: -32602,
              message: `Agent '${agentId}' not found`
            }
          },
          404
        );
      }
      const { message, messages, contextId, taskId} = params || {};
      let messagesList = [];
      if (message) {
        messagesList = [message];
      } else if (messages && Array.isArray(messages)) {
        messagesList = messages;
      }
      console.log(`Processing ${messagesList.length} message(s)`);
      const mastraMessages = messagesList.map((msg) => ({
        role: msg.role,
        content: msg.parts?.map((part) => {
          if (part.kind === "text") return part.text;
          if (part.kind === "data") return JSON.stringify(part.data);
          return "";
        }).join("\n") || ""
      }));
      console.log("Executing agent...");
      const response = await agent.generate(mastraMessages);
      const agentText = response.text || "";
      console.log("Agent response generated successfully");
      const artifacts = [
        {
          artifactId: randomUUID(),
          name: `${agentId}Response`,
          parts: [{ kind: "text", text: agentText }]
        }
      ];
      if (response.toolResults && response.toolResults.length > 0) {
        console.log(
          `Adding ${response.toolResults.length} tool result(s) as artifacts`
        );
        artifacts.push({
          artifactId: randomUUID(),
          name: "ToolResults",
          parts: response.toolResults.map((result) => ({
            kind: "data",
            data: result
          }))
        });
      }
      const history = [
        ...messagesList.map((msg) => ({
          kind: "message",
          role: msg.role,
          parts: msg.parts,
          messageId: msg.messageId || randomUUID(),
          taskId: msg.taskId || taskId || randomUUID()
        })),
        {
          kind: "message",
          role: "agent",
          parts: [{ kind: "text", text: agentText }],
          messageId: randomUUID(),
          taskId: taskId || randomUUID()
        }
      ];
      return c.json({
        jsonrpc: "2.0",
        id: requestId,
        result: {
          id: taskId || randomUUID(),
          contextId: contextId || randomUUID(),
          status: {
            state: "completed",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            message: {
              messageId: randomUUID(),
              role: "agent",
              parts: [{ kind: "text", text: agentText }],
              kind: "message"
            }
          },
          artifacts,
          history,
          kind: "task"
        }
      });
    } catch (error) {
      console.error("Error processing request:", error);
      return c.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32603,
            message: "Internal error",
            data: { details: error.message }
          }
        },
        500
      );
    }
  }
});

console.log("Initializing Health Statistics Agent...");
const storage = new LibSQLStore({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
});
const cacheService = new CacheService(storage);
initHealthToolCache(cacheService);
const mastra = new Mastra({
  agents: {
    healthAgent
  },
  storage,
  logger: new PinoLogger({
    name: "HealthStatsAgent",
    level: "info"
  }),
  observability: {
    default: {
      enabled: true
    }
  },
  server: {
    build: {
      openAPIDocs: true,
      swaggerUI: true
    },
    apiRoutes: [a2aAgentRoute]
  }
});
setInterval(() => cacheService.cleanup(), 6 * 60 * 60 * 1e3);
cacheService.cleanup();
console.log("\u2705 Health Statistics Agent initialized!");
console.log("Registered agents:", Object.keys(mastra.getAgents?.() ?? {}));

export { mastra };
