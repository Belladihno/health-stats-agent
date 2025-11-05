/**
 * A2A Protocol Compliance Test Runner
 *
 * This script tests the Health Agent's A2A endpoint for:
 * 1. Endpoint accessibility (2 pts)
 * 2. A2A protocol support (5 pts)
 * 3. Response format compliance (3 pts)
 *
 * Total: 10 points
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:4111";
const AGENT_ID = "healthAgent";
const endpoint = `${BASE_URL}/a2a/agent/${AGENT_ID}`;

interface TestResult {
  name: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  error?: string;
}

const results: TestResult[] = [];
let totalPoints = 0;
let maxPoints = 0;

async function test(
  name: string,
  points: number,
  fn: () => Promise<void>
): Promise<void> {
  maxPoints += points;
  try {
    await fn();
    results.push({ name, passed: true, points, maxPoints: points });
    totalPoints += points;
    console.log(`✅ ${name} (${points}/${points} pts)`);
  } catch (error) {
    results.push({
      name,
      passed: false,
      points: 0,
      maxPoints: points,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`❌ ${name} (0/${points} pts)`);
    console.log(`   └─ ${error instanceof Error ? error.message : error}`);
  }
}

async function makeRequest(
  payload: any
): Promise<{ status: number; data: any }> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function runTests() {
  console.log("\n🧪 Starting A2A Protocol Compliance Tests...\n");
  console.log(`Testing endpoint: ${endpoint}\n`);

  // ===== SECTION 1: ENDPOINT ACCESSIBILITY (2 pts) =====
  console.log("📡 Section 1: A2A Endpoint Accessibility");

  await test("Endpoint exists and responds", 1, async () => {
    const response = await fetch(endpoint, { method: "POST" });
    if (!response) throw new Error("No response from endpoint");
  });

  await test("Endpoint accepts POST requests", 1, async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "test" }),
    });
    if (!response.ok && response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  });

  // ===== SECTION 2: A2A PROTOCOL SUPPORT (5 pts) =====
  console.log("\n🔌 Section 2: A2A Protocol Support");

  await test("Returns HTTP 200 for valid requests", 1, async () => {
    const { status } = await makeRequest({
      jsonrpc: "2.0",
      id: "test-1",
      params: { messages: [{ role: "user", content: "Hello" }] },
    });
    if (status !== 200) {
      throw new Error(`Expected status 200, got ${status}`);
    }
  });

  await test("Returns HTTP 200 for invalid JSON-RPC version", 1, async () => {
    const { status, data } = await makeRequest({
      jsonrpc: "1.0",
      id: "test-2",
    });
    if (status !== 200) {
      throw new Error(
        `Expected status 200, got ${status} (Endpoint does not accept A2A requests)`
      );
    }
    if (!data.error || data.error.code !== -32600) {
      throw new Error("Should return JSON-RPC error for invalid version");
    }
  });

  await test("Returns HTTP 200 for malformed JSON", 1, async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json }",
    });
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    const data = await response.json();
    if (!data.error || data.error.code !== -32700) {
      throw new Error("Should return parse error");
    }
  });

  await test("Returns HTTP 200 for empty body", 1, async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    });
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
  });

  await test("Returns HTTP 200 for non-existent agent", 1, async () => {
    const response = await fetch(`${BASE_URL}/a2a/agent/fakeAgent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "test-3" }),
    });
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
  });

  // ===== SECTION 3: RESPONSE FORMAT (3 pts) =====
  console.log("\n📋 Section 3: A2A Response Format");

  await test("Response has valid JSON-RPC 2.0 structure", 1, async () => {
    const { data } = await makeRequest({
      jsonrpc: "2.0",
      id: "format-1",
      params: { messages: [{ role: "user", content: "Test" }] },
    });
    if (data.jsonrpc !== "2.0") throw new Error("Missing jsonrpc: 2.0");
    if (!data.id) throw new Error("Missing id field");
    if (!data.result && !data.error) throw new Error("Missing result or error");
  });

  await test("Result contains required A2A task fields", 1, async () => {
    const { data } = await makeRequest({
      jsonrpc: "2.0",
      id: "format-2",
      params: {
        messages: [{ role: "user", content: "Hello" }],
        taskId: "task-123",
        contextId: "ctx-456",
      },
    });
    if (!data.result)
      throw new Error(
        "Cannot test response format: endpoint not responding correctly"
      );
    if (!data.result.id) throw new Error("Missing result.id");
    if (!data.result.contextId) throw new Error("Missing result.contextId");
    if (!data.result.status) throw new Error("Missing result.status");
    if (!data.result.status.state)
      throw new Error("Missing result.status.state");
    if (data.result.kind !== "task")
      throw new Error("result.kind should be 'task'");
  });

  await test("Response includes proper message structure", 1, async () => {
    const { data } = await makeRequest({
      jsonrpc: "2.0",
      id: "format-3",
      params: { messages: [{ role: "user", content: "Test" }] },
    });
    if (!data.result) throw new Error("No result in response");
    const msg = data.result.status.message;
    if (!msg) throw new Error("Missing status.message");
    if (!msg.messageId) throw new Error("Missing messageId");
    if (msg.role !== "agent") throw new Error("Message role should be 'agent'");
    if (!Array.isArray(msg.parts))
      throw new Error("Message parts should be array");
    if (msg.parts[0].kind !== "text")
      throw new Error("Message part kind should be 'text'");
  });

  // ===== BONUS: HEALTH AGENT FUNCTIONALITY =====
  console.log("\n🏥 Bonus: Health Agent Functionality Tests");

  await test("Agent responds to health queries", 0, async () => {
    const { status, data } = await makeRequest({
      jsonrpc: "2.0",
      id: "health-1",
      params: {
        messages: [
          { role: "user", content: "What is life expectancy in Nigeria?" },
        ],
      },
    });
    if (status !== 200) throw new Error(`Status ${status}`);
    if (!data.result) throw new Error("No result");
    const text = data.result.status.message.parts[0].text;
    if (!text || text.length === 0) throw new Error("Empty response");
  });

  await test("Agent handles country comparisons", 0, async () => {
    const { data } = await makeRequest({
      jsonrpc: "2.0",
      id: "health-2",
      params: {
        messages: [
          { role: "user", content: "Compare infant mortality Kenya vs Ghana" },
        ],
      },
    });
    if (!data.result) throw new Error("No result");
  });

  // ===== FINAL RESULTS =====
  console.log("\n" + "=".repeat(50));
  console.log("📊 TEST RESULTS SUMMARY");
  console.log("=".repeat(50));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const percentage = ((totalPoints / maxPoints) * 100).toFixed(1);

  console.log(`\nScore: ${totalPoints}/${maxPoints} (${percentage}%)`);
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);

  console.log("\n📈 Breakdown:");
  console.log(
    `- A2A Endpoint Accessibility: ${results.slice(0, 2).filter((r) => r.passed).length}/2 pts`
  );
  console.log(
    `- A2A Protocol Support: ${results.slice(2, 7).filter((r) => r.passed).length}/5 pts`
  );
  console.log(
    `- A2A Response Format: ${results.slice(7, 10).filter((r) => r.passed).length}/3 pts`
  );

  if (failed > 0) {
    console.log("\n❌ Failed Tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`   └─ ${r.name}: ${r.error}`);
      });
  }

  console.log("\n" + "=".repeat(50));

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error("\n💥 Test runner failed:", error);
  process.exit(1);
});
