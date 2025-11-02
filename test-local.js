/**
 * Simple Cache Performance Test
 * Delays adjusted to avoid Gemini rate limits (10 req/min = 1 req per 6s)
 */

import fetch from "node-fetch";

const AGENT_URL = "http://localhost:4111/a2a/agent/healthAgent";

const testQueries = [
  "What's the life expectancy in USA?",
  "Show me infant mortality in Nigeria",
  "What's the healthcare spending in Ghana?",
];

const makePayload = (query) => ({
  jsonrpc: "2.0",
  id: `test-${Date.now()}`,
  method: "message/send",
  params: {
    message: {
      kind: "message",
      role: "user",
      parts: [{ kind: "text", text: query }],
      messageId: `msg-${Date.now()}`,
      taskId: `task-${Date.now()}`,
    },
    configuration: { blocking: true },
  },
});

const testQuery = async (query, run) => {
  const start = performance.now();

  try {
    const response = await fetch(AGENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makePayload(query)),
    });

    const end = performance.now();
    const duration = ((end - start) / 1000).toFixed(3);

    const data = await response.json();
    const text = data?.result?.status?.message?.parts?.[0]?.text;

    if (!text) {
      console.log(`❌ No response`);
      return 0;
    }

    console.log(`Run ${run}: "${query}"`);
    console.log(`⏱️  ${duration}s`);
    console.log(`💬 Response: ${text.substring(0, 150)}${text.length > 150 ? '...' : ''}\n`);

    return parseFloat(duration);
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    return 0;
  }
};

const runTest = async () => {
  console.log("🧪 Cache Performance Test\n");
  console.log("=" .repeat(60));
  console.log("⏳ Running with 8s delays to avoid rate limits...\n");

  console.log("🌐 First Run (Fresh from API):\n");
  const firstRun = [];
  for (const query of testQueries) {
    const time = await testQuery(query, 1);
    if (time) firstRun.push(time);
    console.log("⏳ Waiting 8s before next query...\n");
    await new Promise((r) => setTimeout(r, 8000)); // 8 seconds to stay under 10/min
  }

  console.log("=" .repeat(60));
  console.log("\n📦 Second Run (Should be Cached):\n");
  const secondRun = [];
  for (const query of testQueries) {
    const time = await testQuery(query, 2);
    if (time) secondRun.push(time);
    if (secondRun.length < testQueries.length) {
      console.log("⏳ Waiting 8s before next query...\n");
      await new Promise((r) => setTimeout(r, 8000));
    }
  }

  const avgFirst = firstRun.length
    ? (firstRun.reduce((a, b) => a + b, 0) / firstRun.length).toFixed(3)
    : 0;

  const avgSecond = secondRun.length
    ? (secondRun.reduce((a, b) => a + b, 0) / secondRun.length).toFixed(3)
    : 0;

  const speedup = avgFirst && avgSecond 
    ? (avgFirst / avgSecond).toFixed(1)
    : 0;

  const improvement = avgFirst && avgSecond
    ? (((avgFirst - avgSecond) / avgFirst) * 100).toFixed(1)
    : 0;

  console.log("\n" + "=" .repeat(60));
  console.log("\n📊 Performance Results:");
  console.log("=" .repeat(60));
  console.log(`🌐 Average (Fresh from API):  ${avgFirst}s`);
  console.log(`📦 Average (Cached):          ${avgSecond}s`);
  console.log(`\n🚀 Speedup:                   ${speedup}x faster`);
  console.log(`📈 Performance improvement:   ${improvement}%`);
  console.log("\n" + "=" .repeat(60));
  console.log("\n✅ Test completed successfully!\n");
};

await runTest();