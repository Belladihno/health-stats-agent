import { registerApiRoute } from "@mastra/core/server";
import { randomUUID } from "crypto";

export const a2aAgentRoute = registerApiRoute("/a2a/agent/:agentId", {
  method: "POST",
  handler: async (c) => {
    // CRITICAL: Wrap everything in try-catch to prevent framework-level 400 errors
    try {
      const mastra = c.get("mastra");
      const agentId = c.req.param("agentId");

      // Parse body with multiple fallback strategies
      let body: any = {};
      let jsonrpc = "2.0";
      let requestId = randomUUID();

      try {
        // Strategy 1: Try to get pre-parsed body (if middleware already parsed it)
        const parsed = await c.req.json().catch(() => null);
        if (parsed) {
          body = parsed;
        } else {
          // Strategy 2: Parse raw text manually
          const raw = await c.req.text();
          if (raw && raw.trim()) {
            body = JSON.parse(raw);
          }
        }

        jsonrpc = body.jsonrpc ?? "2.0";
        requestId = body.id ?? randomUUID();
      } catch (parseError) {
        // Invalid JSON - return JSON-RPC error with HTTP 200
        return c.json(
          {
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32700,
              message: "Parse error: Invalid JSON",
              data: {
                details:
                  parseError instanceof Error
                    ? parseError.message
                    : "Could not parse request body",
              },
            },
          },
          200
        );
      }

      // Validate JSON-RPC version
      if (jsonrpc !== "2.0") {
        return c.json(
          {
            jsonrpc: "2.0",
            id: requestId,
            error: {
              code: -32600,
              message: "Invalid Request: JSON-RPC version must be 2.0",
            },
          },
          200
        );
      }

      // Get agent
      const agent = mastra.getAgent(agentId);
      if (!agent) {
        return c.json(
          {
            jsonrpc: "2.0",
            id: requestId,
            error: {
              code: -32000,
              message: `Agent '${agentId}' not found`,
              data: {
                availableAgents: Object.keys(mastra.getAgents?.() ?? {}),
              },
            },
          },
          200
        );
      }

      // Extract messages from params
      const params = body.params ?? {};
      const messages =
        params.messages ?? (params.message ? [params.message] : []);

      // Ensure we have at least one message
      const userMessage =
        messages
          .filter((m: any) => m?.role === "user" && m?.content)
          .map((m: any) => m.content)
          .join("\n") || "Hello";

      // Generate agent response
      let agentText = "No response generated";
      try {
        const response = await agent.generate(
          messages.length > 0
            ? messages
            : [{ role: "user", content: userMessage }]
        );

        agentText =
          response?.text ??
          (typeof response === "string" ? response : agentText);
      } catch (genErr: any) {
        return c.json(
          {
            jsonrpc: "2.0",
            id: requestId,
            error: {
              code: -32001,
              message: "Agent generation error",
              data: { details: genErr?.message ?? String(genErr) },
            },
          },
          200
        );
      }

      // Build result object
      const taskId = params.taskId ?? randomUUID();
      const contextId = params.contextId ?? randomUUID();
      const messageId = randomUUID();

      const result = {
        id: taskId,
        contextId,
        status: {
          state: "completed",
          timestamp: new Date().toISOString(),
          message: {
            messageId,
            role: "agent",
            parts: [{ kind: "text", text: agentText }],
            kind: "message",
          },
        },
        artifacts: [
          {
            artifactId: randomUUID(),
            name: `${agentId}Response`,
            parts: [{ kind: "text", text: agentText }],
          },
        ],
        history: [
          ...messages.map((m: any) => ({
            kind: "message",
            role: m.role ?? "user",
            parts: [{ kind: "text", text: m.content ?? "" }],
            messageId: m.messageId ?? randomUUID(),
            taskId,
          })),
          {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: agentText }],
            messageId,
            taskId,
          },
        ],
        kind: "task",
      };

      // Handle async push notifications if configured
      const config = params.configuration ?? {};
      if (config.blocking === false && config.pushNotificationConfig?.url) {
        // Fire and forget - don't wait for this
        fetch(config.pushNotificationConfig.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(config.pushNotificationConfig.token && {
              Authorization: `Bearer ${config.pushNotificationConfig.token}`,
            }),
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: requestId,
            result,
          }),
        }).catch((err) => {
          console.error("Push notification failed:", err);
        });
      }

      // Return successful response with HTTP 200
      return c.json(
        {
          jsonrpc: "2.0",
          id: requestId,
          result,
        },
        200
      );
    } catch (err: any) {
      // CRITICAL: Catch-all for any unhandled errors
      // This ensures we ALWAYS return HTTP 200 with JSON-RPC error format
      console.error("Unhandled error in A2A route:", err);

      return c.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32603,
            message: "Internal error",
            data: {
              details: err?.message ?? String(err),
              stack:
                process.env.NODE_ENV === "development" ? err?.stack : undefined,
            },
          },
        },
        200
      );
    }
  },
});
