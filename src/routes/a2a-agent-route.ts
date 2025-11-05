import { registerApiRoute } from "@mastra/core/server";
import { randomUUID } from "crypto";

export const a2aAgentRoute = registerApiRoute("/a2a/agent/:agentId", {
  method: "POST",
  handler: async (c) => {
    try {
      const mastra = c.get("mastra");
      const agentId = c.req.param("agentId");

      // Parse body as raw text to prevent automatic 400 from JSON parser
      let body: any = {};
      try {
        const raw = await c.req.text();
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return c.json(
          {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: "Parse error: Invalid JSON" },
          },
          200
        );
      }

      const jsonrpc = body.jsonrpc ?? "2.0";
      const requestId = body.id ?? randomUUID();
      const params = body.params ?? {};

      // ✅ FORCE: Always return HTTP 200 even for invalid version
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

      const agent = mastra.getAgent(agentId);
      if (!agent) {
        return c.json(
          {
            jsonrpc: "2.0",
            id: requestId,
            error: {
              code: -32000,
              message: `Agent '${agentId}' not found`,
            },
          },
          200
        );
      }

      const messages =
        params.messages ?? (params.message ? [params.message] : []);
      const userMessage =
        messages
          .filter((m: any) => m?.role === "user" && m?.content)
          .map((m: any) => m.content)
          .join("\n") || "Hello";

      let agentText = "No response generated";
      try {
        const response = await agent.generate(messages);
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

      const taskId = params.taskId ?? randomUUID();
      const contextId = params.contextId ?? randomUUID();

      const result = {
        id: taskId,
        contextId,
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
            messageId: randomUUID(),
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
        }).catch(console.error);
      }

      // ✅ Always respond HTTP 200
      return c.json(
        {
          jsonrpc: "2.0",
          id: requestId,
          result,
        },
        200
      );
    } catch (err: any) {
      // ✅ Also force internal errors to HTTP 200
      return c.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32603,
            message: "Internal error",
            data: { details: err?.message ?? String(err) },
          },
        },
        200
      );
    }
  },
});
