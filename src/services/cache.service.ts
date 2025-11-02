import { LibSQLStore } from "@mastra/libsql";

export class CacheService {
  private store: LibSQLStore;
  private tableName = "health_stats_cache";
  private initialized = false;

  constructor(store: LibSQLStore) {
    this.store = store;
  }

  private async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const client = (this.store as any).client;
      if (!client) {
        console.warn("LibSQL client not available, cache disabled");
        return;
      }

      // Drop old table if it exists (migration)
      await client.execute(`DROP TABLE IF EXISTS ${this.tableName}`);

      // Create fresh table with correct schema
      await client.execute(`
        CREATE TABLE ${this.tableName} (
          key TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        )
      `);

      this.initialized = true;
      console.log("✅ Cache initialized");
    } catch (error) {
      console.error("Cache init failed:", error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    await this.init();
    if (!this.initialized) return null;

    try {
      const client = (this.store as any).client;
      const now = Date.now();

      const result = await client.execute({
        sql: `SELECT data FROM ${this.tableName} WHERE key = ? AND expires_at > ?`,
        args: [key, now],
      });

      if (result.rows && result.rows.length > 0) {
        console.log(`📦 Cache HIT: ${key}`);
        return JSON.parse(result.rows[0].data as string) as T;
      }

      console.log(`🌐 Cache MISS: ${key}`);
      return null;
    } catch (error) {
      console.error("Cache read error:", error);
      return null;
    }
  }

  async set(key: string, data: any, ttlMs: number): Promise<void> {
    await this.init();
    if (!this.initialized) return;

    try {
      const client = (this.store as any).client;
      const now = Date.now();
      const expiresAt = now + ttlMs;

      await client.execute({
        sql: `INSERT OR REPLACE INTO ${this.tableName} (key, data, created_at, expires_at) VALUES (?, ?, ?, ?)`,
        args: [key, JSON.stringify(data), now, expiresAt],
      });

      console.log(`✅ Cached: ${key}`);
    } catch (error) {
      console.error("Cache write error:", error);
    }
  }

  async cleanup(): Promise<void> {
    await this.init();
    if (!this.initialized) return;

    try {
      const client = (this.store as any).client;
      await client.execute({
        sql: `DELETE FROM ${this.tableName} WHERE expires_at <= ?`,
        args: [Date.now()],
      });
    } catch (error) {
      console.error("Cache cleanup error:", error);
    }
  }
}

// 90 days TTL - health stats update annually
export const CACHE_TTL = 90 * 24 * 60 * 60 * 1000;