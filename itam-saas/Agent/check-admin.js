import pool from './db.js';

async function checkAdmin() {
  try {
    const result = await pool.query(
      "SELECT id, username, email, role, full_name, created_at FROM auth_users WHERE role = 'admin' ORDER BY created_at"
    );
    
    if (result.rows.length > 0) {
      console.log(`\n✅ Found ${result.rows.length} admin user(s):\n`);
      result.rows.forEach((admin, index) => {
        console.log(`Admin #${index + 1}:`);
        console.log('=====================================');
        console.log(`ID: ${admin.id}`);
        console.log(`Username: ${admin.username}`);
        console.log(`Email: ${admin.email}`);
        console.log(`Full Name: ${admin.full_name || 'N/A'}`);
        console.log(`Role: ${admin.role}`);
        console.log(`Created: ${admin.created_at}`);
        console.log('=====================================\n');
      });
    } else {
      console.log('\n❌ No admin user exists yet!');
      console.log('Create one with: node create-admin.js\n');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkAdmin();
