import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

async function checkData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Check assets
    const assetsCount = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE user_id IS NULL) as null_user_id,
        COUNT(*) FILTER (WHERE user_id IS NOT NULL) as has_user_id,
        COUNT(*) as total
      FROM assets
    `);
    
    console.log('\n📋 Assets Table:');
    console.log(`  Total: ${assetsCount.rows[0].total}`);
    console.log(`  With user_id: ${assetsCount.rows[0].has_user_id}`);
    console.log(`  Without user_id (NULL): ${assetsCount.rows[0].null_user_id}`);
    
    // Check devices
    const devicesCount = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE user_id IS NULL) as null_user_id,
        COUNT(*) FILTER (WHERE user_id IS NOT NULL) as has_user_id,
        COUNT(*) as total
      FROM devices
    `);
    
    console.log('\n📋 Devices Table:');
    console.log(`  Total: ${devicesCount.rows[0].total}`);
    console.log(`  With user_id: ${devicesCount.rows[0].has_user_id}`);
    console.log(`  Without user_id (NULL): ${devicesCount.rows[0].null_user_id}`);
    
    // Check device_usage
    const usageCount = await pool.query(`
      SELECT COUNT(*) as total FROM device_usage
    `);
    
    console.log('\n📋 Device Usage Table:');
    console.log(`  Total records: ${usageCount.rows[0].total}`);
    
    // Check if devices table has RLS
    const deviceRLS = await pool.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE tablename IN ('devices', 'device_usage')
      AND schemaname = 'public'
    `);
    
    console.log('\n📋 RLS Status for Device Tables:');
    deviceRLS.rows.forEach(r => {
      const status = r.rowsecurity ? '✅ ENABLED' : '❌ DISABLED';
      console.log(`  - ${r.tablename}: ${status}`);
    });
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkData();
