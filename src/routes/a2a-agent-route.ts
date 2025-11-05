import { registerApiRoute } from "@mastra/core/server";
import { randomUUID } from "crypto";

export const a2aAgentRoute = registerApiRoute("/a2a/agent/:agentId", {
  method: "POST",
  handler: async (c) => {
    try {
      const mastra = c.get("mastra");
      const agentId = c.req.param("agentId");

      let body: any = {};
      let jsonrpc = "2.0";
      let requestId = randomUUID();

      try {
        const parsed = await c.req.json().catch(() => null);
        if (parsed) {
          body = parsed;
        } else {
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
      let messages = params.messages ?? (params.message ? [params.message] : []);

      messages = messages.map((m: any) => {
        if (m.parts && !m.role) {
          const text = m.parts
            .filter((p: any) => p.kind === "text")
            .map((p: any) => p.text)
            .join("\n");
          return { role: "user", content: text };
        }
        if (m.role && m.content) {
          return m;
        }
        return { role: "user", content: String(m.content || m.text || "") };
      });

      if (messages.length === 0 || !messages[0].content) {
        messages = [{ role: "user", content: "Hello" }];
      }

      // Generate agent response
      let agentText = "No response generated";
      try {
        console.log("Calling agent.generate with messages:", JSON.stringify(messages));
        
        const response = await agent.generate(messages);

        console.log("Agent response:", JSON.stringify(response));

        if (typeof response === "string") {
          agentText = response;
        } else if (response && typeof response === "object") {
          agentText =
            (response as any).text ||
            (response as any).content ||
            (response as any).message ||
            (response as any).choices?.[0]?.message?.content ||
            "No text content in response";
        }

        if (!agentText || agentText === "No response generated" || agentText === "No text content in response") {
          console.error("Failed to extract text from agent response:", response);
          throw new Error("Agent did not return valid text content");
        }
      } catch (genErr: any) {
        console.error("Agent generation error:", genErr);
        return c.json(
          {
            jsonrpc: "2.0",
            id: requestId,
            error: {
              code: -32001,
              message: "Agent generation error",
              data: { 
                details: genErr?.message ?? String(genErr),
                stack: process.env.NODE_ENV === "development" ? genErr?.stack : undefined
              },
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

      const config = params.configuration ?? {};
      if (config.blocking === false && config.pushNotificationConfig?.url) {
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