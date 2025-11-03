// test-a2a.ts - Run this to test your A2A endpoint locally

const BASE_URL = "http://localhost:4111"; // Default Mastra port
const AGENT_ID = "healthAgent";

interface TestCase {
  name: string;
  payload: any;
  expectedStatus?: number;
  shouldPass: boolean;
}

const testCases: TestCase[] = [
  // Test 1: Valid complete request
  {
    name: "✅ Valid complete A2A request",
    shouldPass: true,
    payload: {
      jsonrpc: "2.0",
      id: "test-001",
      method: "agent.execute",
      params: {
        taskId: "task-001",
        contextId: "ctx-001",
        message: {
          role: "user",
          messageId: "msg-001",
          parts: [
            {
              kind: "text",
              text: "What is the life expectancy in Nigeria?",
            },
          ],
        },
        configuration: {
          blocking: true,
        },
      },
    },
  },

  // Test 2: Minimal request (what graders might send)
  {
    name: "✅ Minimal A2A request (no optional fields)",
    shouldPass: true,
    payload: {
      jsonrpc: "2.0",
      params: {
        message: {
          parts: [
            {
              kind: "text",
              text: "Tell me about infant mortality in Kenya",
            },
          ],
        },
      },
    },
  },

  // Test 3: Empty message
  {
    name: "⚠️  Empty message (should handle gracefully)",
    shouldPass: true,
    payload: {
      jsonrpc: "2.0",
      id: "test-003",
      params: {
        message: {
          parts: [],
        },
      },
    },
  },

  // Test 4: Missing jsonrpc version (should fail)
  {
    name: "❌ Missing jsonrpc version (should return 400)",
    shouldPass: false,
    expectedStatus: 400,
    payload: {
      id: "test-004",
      params: {
        message: {
          parts: [{ kind: "text", text: "Test" }],
        },
      },
    },
  },

  // Test 5: Wrong jsonrpc version
  {
    name: "❌ Wrong jsonrpc version (should return 400)",
    shouldPass: false,
    expectedStatus: 400,
    payload: {
      jsonrpc: "1.0",
      id: "test-005",
      params: {
        message: {
          parts: [{ kind: "text", text: "Test" }],
        },
      },
    },
  },

  // Test 6: Compare countries
  {
    name: "✅ Complex query - country comparison",
    shouldPass: true,
    payload: {
      jsonrpc: "2.0",
      id: "test-006",
      params: {
        message: {
          parts: [
            {
              kind: "text",
              text: "Compare life expectancy between USA and Japan",
            },
          ],
        },
      },
    },
  },

  // Test 7: Non-existent country
  {
    name: "✅ Query with invalid country (should handle gracefully)",
    shouldPass: true,
    payload: {
      jsonrpc: "2.0",
      id: "test-007",
      params: {
        message: {
          parts: [
            {
              kind: "text",
              text: "What's the health expenditure in Wakanda?",
            },
          ],
        },
      },
    },
  },
];

// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

async function runTest(test: TestCase): Promise<boolean> {
  console.log(
    `\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`
  );
  console.log(`${colors.blue}Test: ${test.name}${colors.reset}`);
  console.log(`Expected to pass: ${test.shouldPass ? "Yes" : "No"}`);

  try {
    const startTime = Date.now();
    const response = await fetch(`${BASE_URL}/a2a/agent/${AGENT_ID}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(test.payload),
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    console.log(`\nStatus: ${response.status}`);
    console.log(`Duration: ${duration}ms`);

    // Check if test result matches expectation
    const passed = test.shouldPass
      ? response.status === 200 && data.result
      : response.status === (test.expectedStatus || 400);

    if (passed) {
      console.log(`${colors.green}✅ PASS${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ FAIL${colors.reset}`);
    }

    // Show response snippet
    if (data.result) {
      const agentMessage = data.result.status?.message?.parts?.[0]?.text || "";
      console.log(
        `\nAgent Response: ${agentMessage.substring(0, 200)}${agentMessage.length > 200 ? "..." : ""}`
      );
    } else if (data.error) {
      console.log(`\nError: ${data.error.message}`);
      if (data.error.data) {
        console.log(`Details: ${JSON.stringify(data.error.data, null, 2)}`);
      }
    }

    return passed;
  } catch (error: any) {
    console.log(`${colors.red}❌ FAIL - Request Error${colors.reset}`);
    console.log(`Error: ${error.message}`);
    return false;
  }
}

async function testAgentEndpoint() {
  console.log(
    `${colors.cyan}╔════════════════════════════════════════╗${colors.reset}`
  );
  console.log(
    `${colors.cyan}║   A2A Endpoint Local Test Suite       ║${colors.reset}`
  );
  console.log(
    `${colors.cyan}╚════════════════════════════════════════╝${colors.reset}`
  );
  console.log(`\nTesting: ${BASE_URL}/a2a/agent/${AGENT_ID}`);

  // First check if server is running
  try {
    const healthCheck = await fetch(`${BASE_URL}/health`).catch(() => null);
    if (!healthCheck) {
      console.log(
        `${colors.red}\n❌ Server not running at ${BASE_URL}${colors.reset}`
      );
      console.log(`\nStart your server with: npm run dev\n`);
      return;
    }
  } catch (error) {
    console.log(
      `${colors.red}\n❌ Server not running at ${BASE_URL}${colors.reset}`
    );
    console.log(`\nStart your server with: npm run dev\n`);
    return;
  }

  const results = {
    total: testCases.length,
    passed: 0,
    failed: 0,
  };

  // Run all tests
  for (const test of testCases) {
    const passed = await runTest(test);
    if (passed) {
      results.passed++;
    } else {
      results.failed++;
    }
  }

  // Summary
  console.log(
    `\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`
  );
  console.log(`${colors.blue}Test Summary${colors.reset}`);
  console.log(
    `${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`
  );
  console.log(`Total Tests: ${results.total}`);
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  console.log(
    `Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`
  );

  if (results.failed === 0) {
    console.log(
      `\n${colors.green}🎉 All tests passed! Your endpoint is ready for submission.${colors.reset}`
    );
  } else {
    console.log(
      `\n${colors.yellow}⚠️  Some tests failed. Review the errors above.${colors.reset}`
    );
  }

  console.log(`\n`);
}

// Run the tests
testAgentEndpoint().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
