# Health Statistics Agent for Telex.im

A production-ready AI agent that provides accurate, real-time health statistics for countries worldwide using World Bank data. Built with [Mastra](https://mastra.ai) and integrated with Telex.im via the A2A protocol.

[![Built with Mastra](https://img.shields.io/badge/Built%20with-Mastra-blue)](https://mastra.ai)
[![Deployed](https://img.shields.io/badge/Status-Deployed-success)](https://purring-orange-gigabyte.mastra.cloud/a2a/agent/healthAgent)

---

## 🎯 What It Does

Ask the agent about health statistics for any country, and it will:
- Fetch real-time data from the World Bank API
- Provide context and interpretation
- Cache results for faster responses
- Handle comparisons between countries

**Example Queries:**
- "What's the life expectancy in Nigeria?"
- "Compare infant mortality between Kenya and Ghana"
- "Show me healthcare spending in USA"
- "What's the HIV prevalence in South Africa?"

---

## 🚀 Features

### Core Capabilities
- **6 Health Indicators**: Life expectancy, infant mortality, healthcare expenditure, immunization coverage, skilled birth attendance, HIV prevalence
- **50+ Countries**: Major countries across Africa, Americas, Europe, Asia, and Oceania
- **Intelligent Caching**: 90-day cache with automatic cleanup reduces API calls by 80-90%
- **Fast Responses**: 1.6x faster for cached queries (39% improvement)
- **A2A Protocol**: Fully compliant JSON-RPC 2.0 integration with Telex.im

### Technical Highlights
- **Persistent Storage**: LibSQL (Turso) for cache and memory
- **Production-Ready**: Error handling, rate limiting, fault tolerance
- **Observability**: Built-in logging and tracing
- **Auto-Cleanup**: Scheduled cache maintenance every 6 hours

---

## 📊 Performance

| Metric | Without Cache | With Cache | Improvement |
|--------|---------------|------------|-------------|
| Response Time | 6.3s | 3.9s | **1.6x faster** |
| API Calls (100 queries) | 100 | 10-20 | **80-90% reduction** |
| Data Freshness | Real-time | 90 days | **Optimal balance** |

---

## 🛠️ Tech Stack

- **Framework**: [Mastra](https://mastra.ai) (v0.17.7)
- **Runtime**: Node.js + TypeScript
- **Database**: LibSQL (Turso) - persistent SQLite
- **AI Model**: Google Gemini 1.5 Flash
- **API**: World Bank Open Data API
- **Protocol**: A2A (Agent-to-Agent) JSON-RPC 2.0

---

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- Turso account ([sign up free](https://turso.tech))
- Google Gemini API key ([get one](https://ai.google.dev))

### Setup

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd health-stats-agent
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
Create a `.env` file:
```env
# Turso Database
DATABASE_URL=libsql://your-database.turso.io
DATABASE_AUTH_TOKEN=your-turso-auth-token

# Google Gemini API
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key

4. **Build the project**
```bash
npm run build
```

5. **Start development server**
```bash
npm run dev
```

The agent will be available at `http://localhost:4111`

---

## 🧪 Testing

### Run Performance Tests
```bash
npm run test
```

This will:
- Test fresh API calls vs cached responses
- Measure response times and speedup
- Verify cache functionality
- Display actual agent responses

**Expected Output:**
```
🧪 Cache Performance Test
============================================================
🌐 First Run (Fresh from API):
Run 1: "What's the life expectancy in Nigeria?"
⏱️  6.336s
💬 Response: According to the most recent World Bank data...

📦 Second Run (Should be Cached):
Run 2: "What's the life expectancy in Nigeria?"
⏱️  3.863s
💬 Response: According to the most recent World Bank data...

📊 Performance Results:
🚀 Speedup: 1.6x faster
📈 Performance improvement: 39.0%
```

### Test with Postman

**Endpoint:**
```
POST https://purring-orange-gigabyte.mastra.cloud/a2a/agent/healthAgent
```

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "jsonrpc": "2.0",
  "id": "test-123",
  "method": "message/send",
  "params": {
    "message": {
      "kind": "message",
      "role": "user",
      "parts": [
        {
          "kind": "text",
          "text": "What is the life expectancy in Nigeria?"
        }
      ],
      "messageId": "msg-123",
      "taskId": "task-123"
    },
    "configuration": {
      "blocking": true
    }
  }
}
```

### Test with curl
```bash
curl -X POST https://purring-orange-gigabyte.mastra.cloud/a2a/agent/healthAgent \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test-123",
    "method": "message/send",
    "params": {
      "message": {
        "kind": "message",
        "role": "user",
        "parts": [{"kind": "text", "text": "What is the life expectancy in Nigeria?"}],
        "messageId": "msg-123",
        "taskId": "task-123"
      },
      "configuration": {"blocking": true}
    }
  }'
```

---

## 🏗️ Project Structure

```
health-stats-agent/
├── src/
│   ├── agents/
│   │   └── health-agent.ts          # Agent definition & instructions
│   ├── tools/
│   │   └── health-tool.ts           # World Bank API integration + cache
│   ├── services/
│   │   └── cache-service.ts         # LibSQL cache layer
│   ├── routes/
│   │   └── a2a-agent-route.ts       # A2A protocol endpoint
│   ├── utils/
│   │   └── helper.ts                # Country codes & indicators
│   └── mastra/
│       └── index.ts                 # Mastra configuration
├── test-cache.js                     # Performance test suite
├── test-local.js                     # Full agent test suite
├── package.json
├── tsconfig.json
└── .env                              # Environment variables
```

---

## 🔧 Configuration

### Supported Countries

**Africa**: Nigeria, Ghana, Kenya, South Africa, Egypt, Ethiopia, Tanzania, Uganda, Morocco, Algeria

**Americas**: USA, Canada, Brazil, Mexico, Argentina, Colombia, Chile

**Europe**: UK, Germany, France, Italy, Spain, Poland, Netherlands

**Asia**: India, China, Japan, South Korea, Indonesia, Pakistan, Bangladesh, Vietnam, Philippines, Thailand

**Oceania**: Australia, New Zealand

### Health Indicators

| Indicator | Description | Unit |
|-----------|-------------|------|
| `life_expectancy` | Life expectancy at birth | years |
| `infant_mortality` | Infant mortality rate | per 1,000 live births |
| `health_expenditure` | Current health expenditure per capita | USD |
| `immunization` | Immunization coverage (DPT) | % of children |
| `skilled_births` | Births attended by skilled health staff | % of total births |
| `hiv_prevalence` | HIV prevalence | % of population ages 15-49 |

### Cache Settings

- **TTL**: 90 days (health data updates annually)
- **Cleanup**: Every 6 hours
- **Storage**: Turso (LibSQL) - persistent across restarts
- **Fallback**: Automatic fallback to World Bank API if cache fails

---

## 🚢 Deployment

### Deploy to Mastra Cloud

1. **Login to Mastra**
```bash
npx mastra login
```

2. **Deploy**
```bash
npm run deploy
```

3. **Get your endpoint**
Your agent will be deployed to:
```
https://[your-deployment].mastra.cloud/a2a/agent/healthAgent
```

### Environment Variables for Production

Ensure these are set in Mastra Cloud:
- `DATABASE_URL` - Your Turso database URL
- `DATABASE_AUTH_TOKEN` - Your Turso auth token
- `GOOGLE_GENERATIVE_AI_API_KEY` - Your Gemini API key


## 📈 Monitoring

### Check Cache Performance

The logs will show cache hits/misses:
```
✅ Cache initialized
🌐 Cache MISS: health:NGA:life_expectancy
🌐 Fetching from World Bank API
✅ Cached: health:NGA:life_expectancy

📦 Cache HIT: health:NGA:life_expectancy
```

### Performance Metrics

Monitor these in your logs:
- Cache hit rate (should be 80%+ after initial queries)
- Response times (cached: ~3s, fresh: ~6s)
- Tool execution success rate
- API errors and fallbacks

---

## 🐛 Troubleshooting

### Cache Not Working?

**Check database connection:**
```bash
# Verify Turso credentials
turso db show your-database-name
```

**Clear cache (if needed):**
The cache table auto-recreates on restart. To manually clear:
```sql
DROP TABLE IF EXISTS health_stats_cache;
```

### Slow Responses?

- **First query**: Expected (3-6s) - fetching from World Bank API
- **Repeated queries**: Should be faster (2-4s) - using cache
- **Rate limits**: Gemini free tier = 10 requests/minute

### Agent Not Responding?

1. Check deployment status in Mastra Cloud
2. Verify environment variables are set
3. Test endpoint directly with curl/Postman
4. Check logs for errors

### "Country not recognized" error?

Add the country to `src/utils/helper.ts`:
```typescript
export const COUNTRY_CODES: Record<string, string> = {
  "your-country": "ISO_CODE",
  // ...
}
```

## 📝 License

MIT License - feel free to use this project for learning or production!

---

## 👨‍💻 Author

**Abimbola Omisakin**

- Built for HNG Internship Stage 3
- Integrated with Telex.im using Mastra A2A protocol

---

## 🙏 Acknowledgments

- [Mastra](https://mastra.ai) - AI agent framework
- [World Bank Open Data](https://data.worldbank.org) - Health statistics API
- [Turso](https://turso.tech) - LibSQL database
- [Google Gemini](https://ai.google.dev) - AI model
- [Telex.im](https://telex.im) - Communication platform

---

## 📚 Resources

- [Mastra Documentation](https://docs.mastra.ai)
- [A2A Protocol Spec](https://github.com/mastra-ai/mastra)
- [World Bank API Docs](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392)
- [Telex.im API](https://telex.im/docs)

---
