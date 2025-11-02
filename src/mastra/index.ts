import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { healthAgent } from "../agents/health-agent";
import { a2aAgentRoute } from "../routes/a2a-agent-route";
import { initHealthToolCache } from "../tools/health-tool";
import { CacheService } from "../services/cache.service";

console.log("Initializing Health Statistics Agent...");

const storage = new LibSQLStore({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// Initialize cache
const cacheService = new CacheService(storage);
initHealthToolCache(cacheService);

export const mastra = new Mastra({
  agents: { healthAgent },
  storage,
  logger: new PinoLogger({
    name: "HealthStatsAgent",
    level: "info",
  }),
  observability: {
    default: { enabled: true },
  },
  server: {
    build: {
      openAPIDocs: true,
      swaggerUI: true,
    },
    apiRoutes: [a2aAgentRoute],
  },
});

// Run cleanup every 6 hours
setInterval(() => cacheService.cleanup(), 6 * 60 * 60 * 1000);
cacheService.cleanup(); // Run once on startup

console.log("✅ Health Statistics Agent initialized!");
console.log("Registered agents:", Object.keys(mastra.getAgents?.() ?? {}));