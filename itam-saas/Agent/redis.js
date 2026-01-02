import { createClient } from 'redis';

let redisClient = null;

// Metrics imports - lazy loaded to avoid circular dependencies
let cacheOperations = null;
let cacheLatency = null;

async function loadMetrics() {
  if (!cacheOperations) {
    try {
      const metrics = await import('./metrics.js');
      cacheOperations = metrics.cacheOperations;
      cacheLatency = metrics.cacheLatency;
    } catch (e) {
      // Metrics not available, continue without
    }
  }
}

export async function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  if (!process.env.REDIS_URL) {
    console.warn('⚠️ REDIS_URL not set, caching disabled');
    return null;
  }

  try {
    redisClient = createClient({
      url: process.env.REDIS_URL
    });

    redisClient.on('error', (err) => console.error('Redis error:', err));
    redisClient.on('connect', () => console.log('✅ Redis connected'));

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    return null;
  }
}

// Cache wrapper function
// TTL: 20 minutes - balance between freshness and performance
// Cache is invalidated on create/update/delete, so changes appear immediately
export async function getCached(key, fetchFn, ttlSeconds = 1200) {
  await loadMetrics();
  const redis = await getRedisClient();
  
  if (!redis) {
    // No Redis? Just call the function
    return await fetchFn();
  }

  const start = process.hrtime.bigint();
  
  try {
    // Try to get from cache
    const cached = await redis.get(key);
    
    if (cached) {
      const durationNs = process.hrtime.bigint() - start;
      const durationSeconds = Number(durationNs) / 1e9;
      
      console.log(`📦 Cache hit: ${key}`);
      cacheOperations?.inc({ operation: 'get', result: 'hit' });
      cacheLatency?.observe({ operation: 'get' }, durationSeconds);
      
      return JSON.parse(cached);
    }

    // Cache miss - fetch data
    console.log(`🔄 Cache miss: ${key}`);
    cacheOperations?.inc({ operation: 'get', result: 'miss' });
    
    const data = await fetchFn();
    
    // Store in cache
    const setStart = process.hrtime.bigint();
    await redis.setEx(key, ttlSeconds, JSON.stringify(data));
    const setDuration = Number(process.hrtime.bigint() - setStart) / 1e9;
    cacheLatency?.observe({ operation: 'set' }, setDuration);
    
    return data;
  } catch (error) {
    console.error(`Cache error for ${key}:`, error.message);
    // On error, just fetch without cache
    return await fetchFn();
  }
}

// Invalidate cache
export async function invalidateCache(pattern) {
  const redis = await getRedisClient();
  if (!redis) return;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
      console.log(`🗑️ Invalidated ${keys.length} cache keys: ${pattern}`);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error.message);
  }
}

export default { getRedisClient, getCached, invalidateCache };
