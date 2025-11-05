import { registerApiRoute } from "@mastra/core/server";
import { randomUUID } from "crypto";

export const a2aAgentRoute = registerApiRoute("/a2a/agent/:agentId", {
  method: "POST",
  handler: async (c) => {
    try {
      const mastra = c.get("mastra");
      const agentId = c.req.param("agentId");

      const rawBody = await c.req.text();

      let body: any = {};
      let jsonrpc = "2.0";
      let requestId = randomUUID();

      try {
        if (rawBody && rawBody.trim()) {
          body = JSON.parse(rawBody);
        }

        jsonrpc = body.jsonrpc ?? "2.0";
        requestId = body.id ?? randomUUID();
      } catch (parseError) {
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
              data: {
                availableAgents: Object.keys(mastra.getAgents?.() ?? {}),
              },
            },
          },
          200
        );
      }

      const params = body.params ?? {};
      let messages = params.messages ?? (params.message ? [params.message] : []);

      messages = messages.map((m: any) => {
        if (m.parts && Array.isArray(m.parts)) {
          const textParts = m.parts
            .filter((p: any) => {
              return p.kind === "text" || p.type === "text" || (p.text && typeof p.text === "string");
            })
            .map((p: any) => p.text || p.content || "")
            .filter((text: string) => text.trim().length > 0);
          
          const text = textParts.join("\n").trim();
          
          return { 
            role: m.role || "user", 
            content: text || "Hello"
          };
        }
        
        if (m.role && m.content) {
          return { role: m.role, content: String(m.content).trim() };
        }
        
        const content = String(
          m.content || 
          m.text || 
          m.message || 
          (typeof m === "string" ? m : "")
        ).trim();
        
        return { 
          role: m.role || "user", 
          content: content || "Hello"
        };
      });

      messages = messages.filter((m: any) => m.content && m.content.length > 0);

      if (messages.length === 0) {
        messages = [{ role: "user", content: "Hello" }];
      }

      let agentText = "No response generated";
      try {
        const response = await agent.generate(messages);

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
          throw new Error("Agent did not return valid text content");
        }
      } catch (genErr: any) {
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
        }).catch(() => {});
      }

      return c.json(
        {
          jsonrpc: "2.0",
          id: requestId,
          result,
        },
        200
      );
    } catch (err: any) {
      return c.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32603,
            message: "Internal error",
            data: {
              details: err?.message ?? String(err),
              stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
            },
          },
        },
        200
      );
    }
  },
});