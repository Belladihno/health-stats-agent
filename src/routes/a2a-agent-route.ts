import { registerApiRoute } from "@mastra/core/server";
import { randomUUID } from "crypto";

export const a2aAgentRoute = registerApiRoute("/a2a/agent/:agentId", {
  method: "POST",
  handler: async (c) => {
    try {
      const mastra = c.get("mastra");
      const agentId = c.req.param("agentId");

      // Parse body with better error handling
      let body;
      try {
        body = await c.req.json();
      } catch (error) {
        console.error("Invalid JSON body:", error);
        return c.json(
          {
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32700,
              message: "Parse error: Invalid JSON",
            },
          },
          400
        );
      }

      const { jsonrpc, id: requestId, method, params } = body;

      // More lenient validation - only check jsonrpc version
      if (jsonrpc !== "2.0") {
        console.error("Invalid JSON-RPC version:", jsonrpc);
        return c.json(
          {
            jsonrpc: "2.0",
            id: requestId || null,
            error: {
              code: -32600,
              message: "Invalid Request: JSON-RPC version must be 2.0",
            },
          },
          400
        );
      }

      // Check if agent exists
      const agent = mastra.getAgent(agentId);
      if (!agent) {
        console.error(`Agent not found: ${agentId}`);
        console.log(
          "Available agents:",
          Object.keys(mastra.getAgents?.() ?? {})
        );
        return c.json(
          {
            jsonrpc: "2.0",
            id: requestId || null,
            error: {
              code: -32602,
              message: `Agent '${agentId}' not found. Available agents: ${Object.keys(mastra.getAgents?.() ?? {}).join(", ")}`,
            },
          },
          404
        );
      }

      // Handle missing or malformed params gracefully
      const message = params?.message || { parts: [] };
      const configuration = params?.configuration || {};
      const isBlocking = configuration.blocking !== false;

      // Extract text content from message parts
      const userMessage = Array.isArray(message.parts)
        ? message.parts
            .filter((part: any) => part?.kind === "text" && part?.text)
            .map((part: any) => part.text)
            .join("\n")
        : "";

      // Handle empty messages
      if (!userMessage.trim()) {
        console.warn("Empty message received");
        return c.json({
          jsonrpc: "2.0",
          id: requestId || randomUUID(),
          result: {
            id: params?.taskId || randomUUID(),
            contextId: params?.contextId || randomUUID(),
            status: {
              state: "completed",
              timestamp: new Date().toISOString(),
              message: {
                messageId: randomUUID(),
                role: "agent",
                parts: [
                  {
                    kind: "text",
                    text: "I received an empty message. Please ask me a question about health statistics!",
                  },
                ],
                kind: "message",
              },
            },
            artifacts: [],
            history: [],
            kind: "task",
          },
        });
      }

      console.log(
        `Processing message for agent ${agentId}:`,
        userMessage.substring(0, 100)
      );

      // Convert to Mastra format
      const mastraMessages = [
        {
          role: "user" as const,
          content: userMessage,
        },
      ];

      // Execute agent with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Agent execution timeout")), 30000)
      );

      const agentPromise = agent.generate(mastraMessages);
      const response = (await Promise.race([
        agentPromise,
        timeoutPromise,
      ])) as any;

      const agentText =
        response?.text || "I couldn't generate a response. Please try again.";

      console.log(
        `Agent response (${agentText.length} chars):`,
        agentText.substring(0, 100)
      );

      // Build A2A compliant response
      const taskId = params?.taskId || randomUUID();
      const contextId = params?.contextId || randomUUID();
      const responseMessageId = randomUUID();

      const result = {
        id: taskId,
        contextId: contextId,
        status: {
          state: "completed",
          timestamp: new Date().toISOString(),
          message: {
            messageId: responseMessageId,
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
          {
            kind: "message",
            role: message.role || "user",
            parts: message.parts || [],
            messageId: message.messageId || randomUUID(),
            taskId: taskId,
          },
          {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: agentText }],
            messageId: responseMessageId,
            taskId: taskId,
          },
        ],
        kind: "task",
      };

      // Handle non-blocking with webhook
      if (!isBlocking && configuration?.pushNotificationConfig?.url) {
        const webhookUrl = configuration.pushNotificationConfig.url;
        const webhookToken = configuration.pushNotificationConfig.token;

        // Don't await webhook - send it asynchronously
        fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(webhookToken && { Authorization: `Bearer ${webhookToken}` }),
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: requestId || randomUUID(),
            result,
          }),
        }).catch((error) => {
          console.error("Webhook delivery failed:", error);
        });
      }

      // Return successful response
      return c.json({
        jsonrpc: "2.0",
        id: requestId || randomUUID(),
        result,
      });
    } catch (error: any) {
      console.error("Error processing A2A request:", error);

      return c.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32603,
            message: "Internal error",
            data: {
              details: error?.message || "Unknown error",
              stack:
                process.env.NODE_ENV === "development"
                  ? error?.stack
                  : undefined,
            },
          },
        },
        500
      );
    }
  },
});
