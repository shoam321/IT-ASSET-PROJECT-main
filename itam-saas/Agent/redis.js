import { createClient } from 'redis';

let redisClient = null;

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
export async function getCached(key, fetchFn, ttlSeconds = 300) {
  const redis = await getRedisClient();
  
  if (!redis) {
    // No Redis? Just call the function
    return await fetchFn();
  }

  try {
    // Try to get from cache
    const cached = await redis.get(key);
    if (cached) {
      console.log(`📦 Cache hit: ${key}`);
      return JSON.parse(cached);
    }

    // Cache miss - fetch data
    console.log(`🔄 Cache miss: ${key}`);
    const data = await fetchFn();
    
    // Store in cache
    await redis.setEx(key, ttlSeconds, JSON.stringify(data));
    
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
