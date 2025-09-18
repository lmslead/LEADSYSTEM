// Simple in-memory TTL cache for stats
class StatsCache {
  constructor() {
    this.cache = new Map();
    // Clean expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  generateKey(userId, role, organizationId) {
    return `stats:${role}:${organizationId || 'all'}:${userId || 'global'}`;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (item.expireAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key, data, ttlMs = 30000) { // 30 seconds default TTL
    this.cache.set(key, {
      data,
      expireAt: Date.now() + ttlMs
    });
  }

  invalidate(pattern) {
    // Simple pattern matching for cache invalidation
    const keys = Array.from(this.cache.keys());
    keys.forEach(key => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    });
  }

  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (item.expireAt < now) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

module.exports = new StatsCache();