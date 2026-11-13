const Redis = require('ioredis');

// Default cache TTL in seconds (5 minutes)
const DEFAULT_TTL_SECONDS = parseInt(process.env.REDIS_TTL, 10) || 300;

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.hasWarnedOffline = false;
    this.memoryFallback = new Map();

    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = parseInt(process.env.REDIS_PORT, 10) || 6379;
    const password = process.env.REDIS_PASSWORD || undefined;

    const options = {
      host,
      port,
      password,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 3) {
          if (!this.hasWarnedOffline) {
            console.warn(
              `⚠️ Redis not reachable at ${host}:${port}. Gracefully operating in fallback mode.`
            );
            this.hasWarnedOffline = true;
          }
          return null; // Stop retrying automatically to avoid console spam
        }
        return Math.min(times * 200, 1000);
      },
    };

    if (process.env.REDIS_URL) {
      this.client = new Redis(process.env.REDIS_URL, options);
    } else {
      this.client = new Redis(options);
    }

    this.client.on('connect', () => {
      this.isConnected = true;
      this.hasWarnedOffline = false;
      console.log(`✅ Redis Connected: ${host}:${port}`);
    });

    this.client.on('ready', () => {
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      if (!this.hasWarnedOffline) {
        console.warn(`⚠️ Redis Notice: ${err.message}. Operating with fallback.`);
        this.hasWarnedOffline = true;
      }
    });

    this.client.on('close', () => {
      this.isConnected = false;
    });

    // Attempt non-blocking initial connection outside of test environment
    if (process.env.NODE_ENV !== 'test') {
      this.client.connect().catch(() => {
        // Handled by 'error' listener above
      });
    }
  }

  /**
   * Retrieve cached item by key.
   * Returns parsed object or null on cache-miss / offline fallback.
   */
  async get(key) {
    if (this.isConnected && this.client) {
      try {
        const raw = await this.client.get(key);
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        // Fallback to in-memory on unexpected Redis read error
      }
    }

    // In-memory fallback
    const entry = this.memoryFallback.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memoryFallback.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Store item with expiration (in seconds).
   */
  async set(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
    if (this.isConnected && this.client) {
      try {
        const payload = JSON.stringify(value);
        await this.client.set(key, payload, 'EX', ttlSeconds);
        return;
      } catch (_) {
        // Fallback to in-memory on unexpected Redis write error
      }
    }

    // In-memory fallback
    this.memoryFallback.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Delete keys matching a glob pattern (e.g. 'providers:*').
   */
  async clearPattern(pattern) {
    // Clear in-memory fallback matching pattern
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this.memoryFallback.keys()) {
      if (regex.test(key)) {
        this.memoryFallback.delete(key);
      }
    }

    if (!this.isConnected || !this.client) return;

    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = nextCursor;
        if (keys && keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (_) {
      // Graceful error ignore on pattern invalidation
    }
  }

  /**
   * Disconnect client gracefully (used in testing or server shutdown).
   */
  async disconnect() {
    this.memoryFallback.clear();
    if (this.client) {
      try {
        await this.client.quit();
      } catch (_) {
        this.client.disconnect();
      }
    }
  }
}

module.exports = new RedisService();
