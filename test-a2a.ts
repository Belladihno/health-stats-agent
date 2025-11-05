/**
 * test-a2a-fix.ts
 * Full verification of A2A endpoint compliance for Mastra graders.
 */

const BASE_URL = "https://purring-orange-gigabyte-6ccf0b23-0f85-415c-9b1b-5a9ce070f49c.mastra.cloud";
const AGENT_ID = "healthAgent";

const tests = [
  {
    name: "✅ Valid A2A request (params.messages)",
    payload: {
      jsonrpc: "2.0",
      id: "fix-001",
      method: "agent.execute",
      params: {
        taskId: "task-001",
        contextId: "ctx-001",
        messages: [
          { role: "user", content: "What is the life expectancy in Nigeria?" },
        ],
        configuration: { blocking: true },
      },
    },
    expectStatus: 200,
    expect: { result: true, error: false },
  },
  {
    name: "✅ Minimal valid A2A request (no id/method)",
    payload: {
      jsonrpc: "2.0",
      params: {
        messages: [
          { role: "user", content: "Tell me about infant mortality in Kenya" },
        ],
      },
    },
    expectStatus: 200,
    expect: { result: true, error: false },
  },
  {
    name: "✅ Non-blocking A2A with pushNotificationConfig",
    payload: {
      jsonrpc: "2.0",
      id: "fix-003",
      method: "agent.execute",
      params: {
        taskId: "task-003",
        contextId: "ctx-003",
        messages: [
          { role: "user", content: "Give me the current population health summary for Ghana" },
        ],
        configuration: {
          blocking: false,
          pushNotificationConfig: {
            type: "webhook",
            url: "https://example.com/webhook-test",
          },
        },
      },
    },
    expectStatus: 200,
    expect: { result: true, error: false },
  },
  {
    name: "❌ Wrong jsonrpc version (should return JSON-RPC error, not HTTP 400)",
    payload: {
      jsonrpc: "1.0",
      params: [{ role: "user", content: "Test invalid JSON-RPC version" }],
    },
    expectStatus: 200, // JSON-RPC errors must return 200, not 400
    expect: { result: false, error: true },
  },
];

async function run() {
  console.log(`\n🔍 Testing A2A Endpoint Fixes`);
  console.log(`URL: ${BASE_URL}/a2a/agent/${AGENT_ID}\n`);

  for (const t of tests) {
    console.log(`\n🧪 ${t.name}`);
    let response, data;

    try {
      response = await fetch(`${BASE_URL}/a2a/agent/${AGENT_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t.payload),
      });
    } catch (e: any) {
      console.error("❌ Network error:", e.message);
      continue;
    }

    try {
      data = await response.json();
    } catch {
      console.error("❌ Failed to parse JSON response");
      continue;
    }

    const passStatus = response.status === t.expectStatus;
    const isJsonRpc = data.jsonrpc === "2.0";
    const hasResult = typeof data.result !== "undefined";
    const hasError = typeof data.error !== "undefined";

    const passed =
      passStatus &&
      isJsonRpc &&
      t.expect.result === hasResult &&
      t.expect.error === hasError;

    console.log(`Status: ${response.status}`);
    if (hasResult) {
      console.log(`Result kind: ${data.result.kind ?? "(no kind)"}`);
      console.log(`Task state: ${data.result.status?.state ?? "(unknown)"}`);
    }
    if (hasError) console.log(`Error: ${data.error.message ?? JSON.stringify(data.error)}`);

    console.log(passed ? "✅ PASS" : "❌ FAIL");
  }
}

run().catch((err) => console.error("Fatal error:", err));
