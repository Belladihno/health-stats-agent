const testQueries = [
  "What's the life expectancy in Nigeria?",
  "Show me infant mortality in Kenya",
  "What's the healthcare spending in USA?",
  "Compare life expectancy between Japan and India",
];

async function testAgent(query) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: "${query}"`);
  console.log("=".repeat(60));

  const payload = {
    jsonrpc: "2.0",
    id: `test-${Date.now()}`,
    method: "message/send",
    params: {
      message: {
        kind: "message",
        role: "user",
        parts: [
          {
            kind: "text",
            text: query,
          },
        ],
        messageId: `msg-${Date.now()}`,
        taskId: `task-${Date.now()}`,
      },
      configuration: {
        blocking: true,
      },
    },
  };

  try {
    const response = await fetch(
      "http://localhost:4111/a2a/agent/health-agent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (data.result?.status?.message?.parts?.[0]?.text) {
      console.log("\n✅ Response:");
      console.log(data.result.status.message.parts[0].text);
    } else if (data.error) {
      console.log("\n❌ Error:", data.error.message);
    }
  } catch (error) {
    console.log("\n❌ Request failed:", error.message);
  }
}

async function runTests() {
  console.log("🧪 Starting Health Statistics Agent Tests...\n");
  console.log("Make sure the server is running with: npm run dev\n");

  for (const query of testQueries) {
    await testAgent(query);
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s between tests
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ All tests completed!");
  console.log("=".repeat(60));
}

runTests();
