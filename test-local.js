/**
 * Health Statistics Agent Full Test Suite (ES6)
 * ---------------------------------------------
 * ✅ Validates response structure, relevance, and correctness
 * ✅ Handles slow responses, malformed data, and edge cases
 * ✅ Logs timing, averages, and consistency between runs
 */

import fetch from "node-fetch";

const BASE_URL = "http://localhost:4111/a2a/agent/healthAgent";

const testQueries = [
  // ✅ Normal queries
  "What's the life expectancy in Nigeria?",
  "Show me infant mortality in Kenya",
  "What's the healthcare spending in USA?",
  "Compare life expectancy between Japan and India",
  "Tell me about maternal mortality in Brazil",
  "What’s the HIV prevalence rate in South Africa?",

  // ⚠️ Edge & invalid queries
  "What's the healthcare spending in Wakanda?", // fictional
  "life expectancy", // vague
  "", // empty
  "12345", // nonsense
  "What's the GDP in Nigeria?", // unrelated
];

let totalTime = 0;
let successfulTests = 0;
let failedTests = 0;

// 🧩 Build payload
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

// 🧮 Check if response contains measurable data
const containsStat = (text) => /\d+(\.\d+)?/.test(text);

// 🧠 Check if response is relevant to topic
const isRelevantResponse = (query, text) => {
  const topic = query.toLowerCase().match(/life expectancy|mortality|spending|hiv|health|compare/);
  if (!topic) return true;
  return text.toLowerCase().includes(topic[0].split(" ")[0]);
};

// 🚀 Run single test
const testAgent = async (query) => {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 Testing Query: "${query}"`);
  console.log(`${"=".repeat(80)}`);

  const start = performance.now();

  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makePayload(query)),
    });

    const end = performance.now();
    const duration = ((end - start) / 1000).toFixed(2);
    totalTime += parseFloat(duration);

    const data = await response.json();
    const text = data?.result?.status?.message?.parts?.[0]?.text;

    if (!text) {
      console.log(`❌ No response or malformed message structure.`);
      console.log(JSON.stringify(data, null, 2));
      failedTests++;
      return;
    }

    console.log(`\n✅ Response:\n${text}`);
    console.log(`⏱️ Time taken: ${duration} seconds`);

    // ✅ Validation checks
    const hasNumber = containsStat(text);
    const relevant = isRelevantResponse(query, text);

    if (hasNumber && relevant) {
      console.log("🧠 Valid response: contains statistical data and relevant context.");
      successfulTests++;
    } else if (!relevant) {
      console.log("⚠️ Response seems off-topic from the question.");
      failedTests++;
    } else if (!hasNumber) {
      console.log("⚠️ Response lacks measurable data (no numeric values found).");
      failedTests++;
    }

    // 🔁 Consistency check (randomly repeat some)
    if (Math.random() < 0.33 && query.length > 5) {
      console.log("\n🔁 Running consistency check...");
      const repeatRes = await fetch(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makePayload(query)),
      });
      const repeatData = await repeatRes.json();
      const repeatText = repeatData?.result?.status?.message?.parts?.[0]?.text || "";
      if (repeatText && repeatText === text)
        console.log("✅ Consistent response on repeat test.");
      else console.log("⚠️ Response differs slightly on repeat.");
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    failedTests++;
  }
};

// 🧠 Run all tests
const runTests = async () => {
  console.log("🧪 Starting Full Health Agent Test Suite...\n");
  console.log("Ensure your server is running with: npm run dev\n");

  for (const query of testQueries) {
    await testAgent(query);
    await new Promise((r) => setTimeout(r, 2000)); // wait 2s between tests
  }

  const avgTime = successfulTests ? (totalTime / successfulTests).toFixed(2) : 0;

  console.log(`\n${"=".repeat(80)}`);
  console.log("🏁 TEST SUMMARY");
  console.log(`${"=".repeat(80)}`);
  console.log(`✅ Successful tests: ${successfulTests}`);
  console.log(`❌ Failed tests: ${failedTests}`);
  console.log(`📊 Average response time: ${avgTime} seconds`);
  console.log(`${"=".repeat(80)}`);
};

await runTests();
