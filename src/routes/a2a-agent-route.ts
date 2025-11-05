import { registerApiRoute } from "@mastra/core/server";
import { randomUUID } from "crypto";

export const a2aAgentRoute = registerApiRoute("/a2a/agent/:agentId", {
  method: "POST",
  handler: async (c) => {
    try {
      const mastra = c.get("mastra");
      const agentId = c.req.param("agentId");

      // LOG THE RAW REQUEST BODY FIRST
      const rawBody = await c.req.text();
      console.log("🔍 ========== INCOMING WEBHOOK REQUEST ==========");
      console.log("Raw body:", rawBody);
      console.log("Content-Type:", c.req.header("content-type"));
      console.log("Agent ID:", agentId);

      let body: any = {};
      let jsonrpc = "2.0";
      let requestId = randomUUID();

      try {
        // Parse the raw body
        if (rawBody && rawBody.trim()) {
          body = JSON.parse(rawBody);
          console.log("📦 Parsed body:", JSON.stringify(body, null, 2));
        } else {
          console.log("⚠️ Empty request body");
        }

        jsonrpc = body.jsonrpc ?? "2.0";
        requestId = body.id ?? randomUUID();
      } catch (parseError) {
        console.error("❌ JSON parse error:", parseError);
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
        console.log("⚠️ Invalid JSON-RPC version:", jsonrpc);
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
        console.log("❌ Agent not found:", agentId);
        console.log(
          "Available agents:",
          Object.keys(mastra.getAgents?.() ?? {})
        );
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

      // Extract messages from params with enhanced parsing
      const params = body.params ?? {};
      console.log("📋 Params received:", JSON.stringify(params, null, 2));

      // Get messages from various possible locations
      let messages =
        params.messages ?? (params.message ? [params.message] : []);
      console.log(
        "📨 Initial messages array:",
        JSON.stringify(messages, null, 2)
      );

      // Enhanced message parsing to handle multiple formats
      messages = messages.map((m: any, index: number) => {
        console.log(
          `🔄 Processing message ${index}:`,
          JSON.stringify(m, null, 2)
        );

        // Handle A2A format with parts array
        if (m.parts && Array.isArray(m.parts)) {
          const textParts = m.parts
            .filter((p: any) => {
              return (
                p.kind === "text" ||
                p.type === "text" ||
                (p.text && typeof p.text === "string")
              );
            })
            .map((p: any) => p.text || p.content || "")
            .filter((text: string) => text.trim().length > 0);

          const text = textParts.join("\n").trim();
          console.log(`  ✓ Extracted from parts: "${text}"`);

          return {
            role: m.role || "user",
            content: text || "Hello",
          };
        }

        // Handle standard chat format with role and content
        if (m.role && m.content) {
          console.log(
            `  ✓ Standard format: role=${m.role}, content="${m.content}"`
          );
          return { role: m.role, content: String(m.content).trim() };
        }

        // Handle various other formats
        const content = String(
          m.content || m.text || m.message || (typeof m === "string" ? m : "")
        ).trim();

        console.log(`  ✓ Fallback extraction: "${content}"`);

        return {
          role: m.role || "user",
          content: content || "Hello",
        };
      });

      // Filter out messages with empty content
      messages = messages.filter((m: any) => {
        const hasContent =
          m.content && m.content.length > 0 && m.content !== "Hello";
        if (!hasContent) {
          console.log(
            "⚠️ Filtered out empty/generic message:",
            JSON.stringify(m)
          );
        }
        return m.content && m.content.length > 0;
      });

      // Ensure we have at least one message
      if (messages.length === 0) {
        console.log("⚠️ No valid messages found, using default");
        messages = [{ role: "user", content: "Hello" }];
      }

      console.log(
        "✅ Final messages for agent:",
        JSON.stringify(messages, null, 2)
      );

      // Generate agent response
      let agentText = "No response generated";
      try {
        console.log("🤖 Calling agent.generate...");

        const response = await agent.generate(messages);

        console.log(
          "📤 Agent raw response:",
          JSON.stringify(response, null, 2)
        );

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

        console.log(
          "✅ Extracted agent text:",
          agentText.substring(0, 200) + "..."
        );

        if (
          !agentText ||
          agentText === "No response generated" ||
          agentText === "No text content in response"
        ) {
          console.error("❌ Failed to extract text from agent response");
          throw new Error("Agent did not return valid text content");
        }
      } catch (genErr: any) {
        console.error("❌ Agent generation error:", genErr);
        return c.json(
          {
            jsonrpc: "2.0",
            id: requestId,
            error: {
              code: -32001,
              message: "Agent generation error",
              data: {
                details: genErr?.message ?? String(genErr),
                stack:
                  process.env.NODE_ENV === "development"
                    ? genErr?.stack
                    : undefined,
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
        console.log(
          "📤 Sending push notification to:",
          config.pushNotificationConfig.url
        );
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
          console.error("❌ Push notification failed:", err);
        });
      }

      console.log("✅ ========== REQUEST COMPLETED SUCCESSFULLY ==========\n");

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
      console.error("💥 ========== UNHANDLED ERROR ==========");
      console.error("Error:", err);
      console.error("Stack:", err?.stack);
      console.error("==========================================\n");

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
