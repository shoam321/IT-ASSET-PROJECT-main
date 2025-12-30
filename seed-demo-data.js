// Seed Database with Demo Data for IT Asset Tracker
// Run: node seed-demo-data.js

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Sample data generators
const categories = ['Laptop', 'Desktop', 'Monitor', 'Printer', 'Server', 'Tablet', 'Phone', 'Network Equipment', 'Software License', 'Peripheral'];
const statuses = ['Active', 'In Repair', 'In Storage', 'Retired', 'On Order', 'Deployed'];
const locations = ['Office A', 'Office B', 'Warehouse', 'Data Center', 'Remote - Employee Home', 'Conference Room 1', 'IT Department'];
const manufacturers = ['Dell', 'HP', 'Lenovo', 'Apple', 'Microsoft', 'Samsung', 'Cisco', 'Canon', 'Epson'];
const softwareNames = ['Microsoft Office 365', 'Adobe Creative Cloud', 'AutoCAD', 'Slack Enterprise', 'Zoom Pro', 'Salesforce', 'Jira', 'Confluence'];

// Random helpers
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

async function seedData() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Starting database seeding...\n');

    // Get existing user IDs
    const usersResult = await client.query('SELECT id FROM auth_users LIMIT 5');
    const userIds = usersResult.rows.map(r => r.id);
    
    if (userIds.length === 0) {
      console.log('⚠️  No users found. Please create users first.');
      return;
    }

    console.log(`Found ${userIds.length} users to assign assets to.\n`);

    // Set user context for RLS
    const userId = userIds[0];
    await client.query(`SET app.current_user_id = ${userId}`);
    console.log(`🔐 Set app.current_user_id to ${userId} for RLS\n`);

    // Check if data already exists
    const assetCountCheck = await client.query('SELECT COUNT(*) FROM assets');
    if (parseInt(assetCountCheck.rows[0].count) > 50) {
      console.log('⚠️  Database already has data. Skipping seed to avoid duplicates.');
      console.log('   Run this SQL to clear first: DELETE FROM assets; DELETE FROM licenses; DELETE FROM consumables; DELETE FROM contracts;');
      return;
    }

    // 1. CREATE ASSETS (100 items)
    console.log('📦 Creating 100 assets...');
    const assetCount = 100;
    const assetIds = [];

    for (let i = 0; i < assetCount; i++) {
      const category = randomItem(categories);
      const status = randomItem(statuses);
      const manufacturer = randomItem(manufacturers);
      const userId = randomItem(userIds);
      const createdAt = randomDate(new Date(2024, 0, 1), new Date());
      const cost = randomInt(200, 5000);

      const result = await client.query(`
        INSERT INTO assets (
          asset_tag, asset_type, manufacturer, model, serial_number,
          assigned_user_name, status, category, cost, created_at, user_id, discovered
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `, [
        `AST-${randomInt(10000, 99999)}`,
        category,
        manufacturer,
        `Model ${randomInt(100, 999)}`,
        `SN${randomInt(100000, 999999)}`,
        Math.random() > 0.3 ? `Employee ${randomInt(1, 50)}` : null,
        status,
        category,
        cost,
        createdAt,
        userId,
        Math.random() > 0.5
      ]);

      assetIds.push(result.rows[0].id);
    }
    console.log(`✅ Created ${assetCount} assets\n`);

    // 2. CREATE LICENSES (30 items)
    console.log('📄 Creating 30 software licenses...');
    const licenseCount = 30;

    for (let i = 0; i < licenseCount; i++) {
      const software = randomItem(softwareNames);
      const expirationDate = randomDate(new Date(2025, 0, 1), new Date(2026, 11, 31));
      const cost = randomInt(50, 500);

      await client.query(`
        INSERT INTO licenses (
          license_name, software_name, license_key, license_type, vendor,
          expiration_date, quantity, cost, status, notes, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        `${software} License ${i + 1}`,
        software,
        `${software.substring(0, 3).toUpperCase()}-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`,
        randomItem(['Enterprise', 'Professional', 'Standard', 'Basic']),
        randomItem(['Microsoft', 'Adobe', 'Atlassian', 'Zoom', 'Slack']),
        expirationDate,
        randomInt(1, 50),
        cost,
        expirationDate > new Date() ? 'Active' : 'Expired',
        Math.random() > 0.5 ? 'Enterprise license' : null,
        userId
      ]);
    }
    console.log(`✅ Created ${licenseCount} licenses\n`);

    // 3. CREATE CONSUMABLES (20 items)
    console.log('🖨️ Creating 20 consumable items...');
    const consumables = [
      { name: 'Printer Toner - Black', quantity: 5, min_quantity: 10 },
      { name: 'Printer Toner - Color', quantity: 3, min_quantity: 8 },
      { name: 'USB Cables', quantity: 25, min_quantity: 20 },
      { name: 'HDMI Cables', quantity: 8, min_quantity: 15 },
      { name: 'Ethernet Cables Cat6', quantity: 30, min_quantity: 25 },
      { name: 'Laptop Chargers - Dell', quantity: 4, min_quantity: 10 },
      { name: 'Laptop Chargers - HP', quantity: 6, min_quantity: 12 },
      { name: 'Wireless Mice', quantity: 15, min_quantity: 20 },
      { name: 'Keyboards', quantity: 12, min_quantity: 15 },
      { name: 'Monitor Stands', quantity: 8, min_quantity: 10 },
      { name: 'Webcams', quantity: 3, min_quantity: 8 },
      { name: 'Headsets', quantity: 18, min_quantity: 15 },
      { name: 'Paper Reams', quantity: 50, min_quantity: 30 },
      { name: 'Network Switches', quantity: 2, min_quantity: 5 },
      { name: 'Power Strips', quantity: 10, min_quantity: 15 },
      { name: 'Laptop Bags', quantity: 6, min_quantity: 10 },
      { name: 'External Hard Drives 1TB', quantity: 4, min_quantity: 8 },
      { name: 'RAM 16GB DDR4', quantity: 8, min_quantity: 12 },
      { name: 'SSD 500GB', quantity: 5, min_quantity: 10 },
      { name: 'Monitor Cables VGA', quantity: 7, min_quantity: 10 }
    ];

    for (const consumable of consumables) {
      await client.query(`
        INSERT INTO consumables (name, quantity, min_quantity, unit_cost, supplier, user_id, location, unit)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        consumable.name,
        consumable.quantity,
        consumable.min_quantity,
        randomInt(10, 150),
        randomItem(['Amazon Business', 'CDW', 'Staples', 'Dell Direct', 'Best Buy Business']),
        userId,
        randomItem(locations),
        'unit'
      ]);
    }
    console.log(`✅ Created ${consumables.length} consumable items\n`);

    // 4. CREATE CONTRACTS (15 items)
    console.log('📋 Creating 15 vendor contracts...');
    const vendors = ['Microsoft', 'Dell', 'HP', 'Cisco', 'Adobe', 'AWS', 'Google Cloud', 'Salesforce'];
    
    for (let i = 0; i < 15; i++) {
      const startDate = randomDate(new Date(2023, 0, 1), new Date(2024, 11, 31));
      const endDate = new Date(startDate.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year later

      await client.query(`
        INSERT INTO contracts (
          contract_name, vendor, contract_type, start_date, end_date,
          value, renewal_date, contact_person, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        `${randomItem(vendors)} Agreement ${i + 1}`,
        randomItem(vendors),
        randomItem(['Service Agreement', 'Support Contract', 'License Agreement', 'Maintenance Contract']),
        startDate,
        endDate,
        randomInt(5000, 50000),
        endDate,
        `Contact ${randomInt(1, 100)}`,
        'Annual contract renewal'
      ]);
    }
    console.log(`✅ Created 15 contracts\n`);

    // 5. CREATE AGENT USAGE DATA (200 entries for trends)
    console.log('📊 Creating 200 agent usage entries...');
    const deviceNames = ['LT-SHOAM-TA', 'LT-ADMIN-001', 'DT-DEV-042', 'LT-SALES-15', 'DT-DESIGN-03'];
    
    for (let i = 0; i < 200; i++) {
      const userId = randomItem(userIds);
      const deviceName = randomItem(deviceNames);
      const timestamp = randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date());

      await client.query(`
        INSERT INTO agent_usage (
          user_id, device_name, cpu_usage, ram_usage, disk_usage,
          network_usage, uptime, installed_software, forbidden_apps, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        userId,
        deviceName,
        randomInt(10, 90),
        randomInt(20, 85),
        randomInt(30, 95),
        randomInt(5, 100),
        randomInt(1000, 86400),
        JSON.stringify(['Chrome', 'VS Code', 'Slack', 'Zoom']),
        JSON.stringify([]),
        timestamp
      ]);
    }
    console.log(`✅ Created 200 agent usage entries\n`);

    console.log('🎉 Database seeding completed successfully!\n');
    console.log('📈 Summary:');
    console.log(`   - ${assetCount} Assets`);
    console.log(`   - ${licenseCount} Licenses`);
    console.log(`   - ${consumables.length} Consumables (some low stock)`);
    console.log(`   - 15 Contracts`);
    console.log(`   - 200 Agent Usage Entries`);
    console.log('\n✅ Your Grafana dashboards should now show meaningful data!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeder
seedData().catch(console.error);
