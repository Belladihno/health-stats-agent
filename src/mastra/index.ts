import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { healthAgent } from "../agents/health-agent";
import { a2aAgentRoute } from "../routes/a2a-agent-route";

console.log("healthAgent import (raw):", healthAgent);

console.log("Initializing Health Statistics Agent...");

export const mastra = new Mastra({
  agents: { healthAgent },
  storage: new LibSQLStore({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  }),
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

console.log("Health Statistics Agent initialized successfully!");
const registeredAgents = mastra.getAgents?.() ?? {};
console.log("Registered agents:", Object.keys(registeredAgents));
