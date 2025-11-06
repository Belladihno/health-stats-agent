# Health Statistics Agent

A production-ready AI agent that provides accurate health statistics for countries worldwide using World Bank data. Built with [Mastra](https://mastra.ai) and compliant with the A2A (Agent-to-Agent) protocol for seamless integration with platforms like Telex.im.


---

## 🎯 What It Does

The Health Statistics Agent provides real-time health data from the World Bank API. Ask questions about any supported country and receive accurate, contextual health statistics.

**Example Queries:**
- "What's the life expectancy in Nigeria?"
- "Compare infant mortality between Kenya and Ghana"
- "Show me healthcare expenditure in USA"
- "What's the HIV prevalence in South Africa?"

---

## 🚀 Features

### Health Indicators
- **Life Expectancy**: Life expectancy at birth (years)
- **Infant Mortality**: Infant mortality rate (per 1,000 live births)
- **Health Expenditure**: Current health expenditure per capita (USD)
- **Immunization**: Immunization coverage - DPT (% of children ages 12-23 months)
- **Skilled Births**: Births attended by skilled health staff (% of total births)
- **HIV Prevalence**: HIV prevalence (% of population ages 15-49)

### Supported Countries
**Africa**: Nigeria, Ghana, Kenya, South Africa, Egypt, Ethiopia, Tanzania, Uganda, Morocco, Algeria

**Americas**: USA, Canada, Brazil, Mexico, Argentina, Colombia, Chile

**Europe**: UK, Germany, France, Italy, Spain, Poland, Netherlands

**Asia**: India, China, Japan, South Korea, Indonesia, Pakistan, Bangladesh, Vietnam, Philippines, Thailand

**Oceania**: Australia, New Zealand

### Technical Features
- ✅ **A2A Protocol Compliant**: Full JSON-RPC 2.0 support with proper error handling
- ✅ **Intelligent Caching**: 90-day cache using LibSQL (Turso) reduces API calls
- ✅ **Error Handling**: Graceful fallbacks and informative error messages
- ✅ **Memory System**: Conversation context preserved across interactions
- ✅ **World Bank Integration**: Real-time data from official World Bank API

---

## 🛠️ Tech Stack

- **Framework**: [Mastra](https://mastra.ai) (v0.17.7)
- **Runtime**: Node.js + TypeScript
- **Database**: LibSQL (Turso) for caching and memory
- **AI Model**: Groq Llama 3.3 70B Versatile
- **Data Source**: World Bank Open Data API
- **Protocol**: A2A (Agent-to-Agent) JSON-RPC 2.0

---

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- Turso account ([sign up free](https://turso.tech))
- Groq API key ([get one](https://console.groq.com))

### Setup Steps

1. **Clone the repository**
```bash
git clone https://github.com/Belladihno/health-stats-agent
cd health-stats-agent
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the root directory:
```env
# Turso Database
DATABASE_URL=libsql://your-database.turso.io
DATABASE_AUTH_TOKEN=your-turso-auth-token

# Groq API Key
GROQ_API_KEY=your-groq-api-key
```

4. **Start the development server**
```bash
npm run dev
```

The agent will be available at `https://purring-orange-gigabyte.mastra.cloud/a2a/agent/healthAgent`

---

## 🧪 Testing

### A2A Protocol Compliance Tests

Run the comprehensive test suite to verify A2A protocol compliance:

```bash
npm run test:a2a
```

**What's Tested:**
- ✅ Endpoint Accessibility (2 pts)
- ✅ A2A Protocol Support - HTTP 200 responses for all cases (5 pts)
- ✅ Response Format - Proper JSON-RPC 2.0 structure (3 pts)
- ✅ Health Agent Functionality (Bonus tests)

**Expected Output:**
```
🧪 Starting A2A Protocol Compliance Tests...

📡 Section 1: A2A Endpoint Accessibility
✅ Endpoint exists and responds (1/1 pts)
✅ Endpoint accepts POST requests (1/1 pts)

🔌 Section 2: A2A Protocol Support
✅ Returns HTTP 200 for valid requests (1/1 pts)
✅ Returns HTTP 200 for invalid JSON-RPC version (1/1 pts)
✅ Returns HTTP 200 for malformed JSON (1/1 pts)
✅ Returns HTTP 200 for empty body (1/1 pts)
✅ Returns HTTP 200 for non-existent agent (1/1 pts)

📋 Section 3: A2A Response Format
✅ Response has valid JSON-RPC 2.0 structure (1/1 pts)
✅ Result contains required A2A task fields (1/1 pts)
✅ Response includes proper message structure (1/1 pts)

==================================================
Score: 10/10 (100.0%)
Passed: 10/10
==================================================
```

### Test with curl

```bash
curl -X POST https://purring-orange-gigabyte.mastra.cloud/a2a/agent/healthAgent \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test-123",
    "params": {
      "messages": [
        {
          "role": "user",
          "content": "What is the life expectancy in Nigeria?"
        }
      ]
    }
  }'
```

---

## 🏗️ Project Structure

```
health-stats-agent/
├── src/
│   ├── agents/
│   │   └── health-agent.ts          # Agent configuration and instructions
│   ├── tools/
│   │   └── health-tool.ts           # World Bank API integration
│   ├── services/
│   │   └── cache.service.ts         # LibSQL caching layer
│   ├── routes/
│   │   └── a2a-agent-route.ts       # A2A protocol endpoint handler
│   ├── utils/
│   │   └── helper.ts                # Country codes & health indicators
│   └── mastra/
│       └── index.ts                 # Mastra initialization
├── test-a2a.ts                       # A2A compliance test suite
├── package.json
├── tsconfig.json
└── .env                              # Environment variables
```

---

## 📡 A2A Protocol

### Request Format

```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "params": {
    "messages": [
      {
        "role": "user",
        "content": "What is the life expectancy in Nigeria?"
      }
    ],
    "taskId": "optional-task-id",
    "contextId": "optional-context-id"
  }
}
```

### Success Response

```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "result": {
    "id": "task-id",
    "contextId": "context-id",
    "status": {
      "state": "completed",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "message": {
        "messageId": "msg-id",
        "role": "agent",
        "parts": [
          {
            "kind": "text",
            "text": "According to World Bank data from 2022, the life expectancy at birth in Nigeria is 54.7 years..."
          }
        ],
        "kind": "message"
      }
    },
    "artifacts": [...],
    "history": [...],
    "kind": "task"
  }
}
```

### Error Response

```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "error": {
    "code": -32600,
    "message": "Invalid Request: JSON-RPC version must be 2.0",
    "data": {
      "details": "Additional error information"
    }
  }
}
```

**Important**: All responses return HTTP 200 status. Errors are communicated through the JSON-RPC error object.

---

## 🗄️ Caching System

The agent uses an intelligent caching system to optimize performance:

- **Storage**: LibSQL (Turso) - persistent across restarts
- **TTL**: 90 days (health statistics update annually)
- **Automatic Cleanup**: Runs every 6 hours
- **Cache Keys**: Format `health:{COUNTRY_CODE}:{INDICATOR}`

**Example Logs:**
```
✅ Cache initialized
🌐 Cache MISS: health:NGA:life_expectancy
🌐 Fetching from World Bank API
✅ Cached: health:NGA:life_expectancy

📦 Cache HIT: health:NGA:life_expectancy
```

---

## 🚢 Deployment

### Deploy to Mastra Cloud

1. **Login to Mastra**
```bash
npx mastra login
```

2. **Deploy the agent**
```bash
npm run deploy
```

3. **Your endpoint will be available at:**
```
https://purring-orange-gigabyte.mastra.cloud/a2a/agent/healthAgent
```

### Required Environment Variables

Ensure these are configured in your deployment environment:
- `DATABASE_URL` - Turso database URL
- `DATABASE_AUTH_TOKEN` - Turso authentication token
- `GROQ_API_KEY` - Groq API key

---

## 🔧 Configuration

### Adding New Countries

Edit `src/utils/helper.ts`:
```typescript
export const COUNTRY_CODES: Record<string, string> = {
  "your-country": "ISO_CODE",
  // existing countries...
}
```

### Adjusting Cache TTL

Edit `src/services/cache.service.ts`:
```typescript
// Change from 90 days to desired duration
export const CACHE_TTL = 90 * 24 * 60 * 60 * 1000;
```

---

## 🐛 Troubleshooting

### Agent Not Responding

1. **Check if server is running:**
```bash
# Should show the server running on port 4111
ps aux | grep node
```

2. **Verify environment variables:**
```bash
echo $DATABASE_URL
echo $GROQ_API_KEY
```

3. **Check logs for errors:**
Look for initialization messages and any error logs in the console.

### Database Connection Issues

**Verify Turso credentials:**
```bash
turso db show your-database-name
```

**Test connection:**
```bash
turso db shell your-database-name
```

### "Country not recognized" Error

The requested country may not be in the supported list. Check `src/utils/helper.ts` for available countries.

---

## 📝 Scripts

```json
{
  "dev": "mastra dev",           // Start development server
  "build": "tsc",                // Build TypeScript
  "deploy": "mastra deploy",     // Deploy to Mastra Cloud
  "test:a2a": "tsx test-a2a.ts"  // Run A2A compliance tests
}
```

---

## 👨‍💻 Author

**Abimbola Omisakin**

Built for HNG Internship Stage 3 - A2A Protocol Implementation

---

## 📚 Resources

- [Mastra Documentation](https://docs.mastra.ai)
- [World Bank API Documentation](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392)
- [Turso Documentation](https://docs.turso.tech)
- [Groq API Documentation](https://console.groq.com/docs)
- [A2A Protocol Specification](https://docs.anthropic.com/en/docs/a2a)

---

## 📄 License

MIT License - See LICENSE file for details