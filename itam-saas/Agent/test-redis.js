import dotenv from 'dotenv';
import { getRedisClient, getCached } from './redis.js';

// Load environment variables from .env file
dotenv.config();

async function testRedis() {
  console.log('\n🧪 Testing Redis Connection...\n');
  
  try {
    // Test connection
    const redis = await getRedisClient();
    
    if (!redis) {
      console.log('❌ Redis not available (check REDIS_URL in .env)');
      return;
    }
    
    console.log('✅ Redis connected!\n');
    
    // Test basic operations
    await redis.set('test:key', 'Hello Redis!');
    const value = await redis.get('test:key');
    console.log(`📦 Set/Get test: ${value}`);
    
    // Test cache wrapper
    let callCount = 0;
    const fetchData = async () => {
      callCount++;
      return { data: 'Expensive data', timestamp: Date.now() };
    };
    
    console.log('\n🔄 Testing cache wrapper...\n');
    
    // First call - should fetch
    const result1 = await getCached('test:cache', fetchData, 10);
    console.log(`Call 1: ${callCount} DB queries - Result:`, result1);
    
    // Second call - should use cache
    const result2 = await getCached('test:cache', fetchData, 10);
    console.log(`Call 2: ${callCount} DB queries - Result:`, result2);
    
    if (callCount === 1) {
      console.log('\n✅ Cache working! Only 1 DB query for 2 requests\n');
    } else {
      console.log('\n❌ Cache not working - multiple DB queries\n');
    }
    
    // Cleanup
    await redis.del('test:key', 'test:cache');
    await redis.disconnect();
    
  } catch (error) {
    console.error('❌ Redis test failed:', error.message);
  }
}

testRedis();
