import { registerApiRoute } from "@mastra/core/server";
import { randomUUID } from "crypto";

export const a2aAgentRoute = registerApiRoute("/a2a/agent/:agentId", {
  method: "POST",
  handler: async (c) => {
    try {
      const mastra = c.get("mastra");
      const agentId = c.req.param("agentId");
      const body = await c.req.json();
      
      const { jsonrpc, id: requestId, method, params } = body;

      // Validate JSON-RPC
      if (jsonrpc !== "2.0" || !requestId) {
        return c.json({
          jsonrpc: "2.0",
          id: requestId || null,
          error: { code: -32600, message: "Invalid Request" },
        }, 400);
      }

      const agent = mastra.getAgent(agentId);
      if (!agent) {
        return c.json({
          jsonrpc: "2.0",
          id: requestId,
          error: { code: -32602, message: `Agent '${agentId}' not found` },
        }, 404);
      }

      const { message, configuration } = params || {};
      const isBlocking = configuration?.blocking !== false;

      // Convert message
      const mastraMessages = [{
        role: message.role,
        content: message.parts
          ?.map((part: any) => {
            if (part.kind === "text") return part.text;
            if (part.kind === "data") return JSON.stringify(part.data);
            return "";
          })
          .join("\n") || "",
      }];

      // Execute agent
      const response = await agent.generate(mastraMessages);
      const agentText = response.text || "";

      // Build response
      const result = {
        id: params.taskId || randomUUID(),
        contextId: params.contextId || randomUUID(),
        status: {
          state: "completed",
          timestamp: new Date().toISOString(),
          message: {
            messageId: randomUUID(),
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
            role: message.role,
            parts: message.parts,
            messageId: message.messageId || randomUUID(),
            taskId: params.taskId || randomUUID(),
          },
          {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: agentText }],
            messageId: randomUUID(),
            taskId: params.taskId || randomUUID(),
          },
        ],
        kind: "task",
      };

      // For non-blocking, send webhook if provided
      if (!isBlocking && configuration?.pushNotificationConfig) {
        const webhookUrl = configuration.pushNotificationConfig.url;
        const webhookToken = configuration.pushNotificationConfig.token;
        
        try {
          await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${webhookToken}`,
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: requestId,
              result,
            }),
          });
        } catch (error) {
          console.error("Webhook delivery failed:", error);
        }
      }

      return c.json({
        jsonrpc: "2.0",
        id: requestId,
        result,
      });
      
    } catch (error: any) {
      console.error("Error processing request:", error);
      return c.json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: "Internal error",
          data: { details: error.message },
        },
      }, 500);
    }
  },
});
