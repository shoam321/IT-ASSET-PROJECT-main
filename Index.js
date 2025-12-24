// Discovery Agent Core Logic (Node.js/Render)
import admin from 'firebase-admin';
import fetch from 'node-fetch';
import 'dotenv/config';

// --- CONFIGURATION ---
const CONFIG = {
  discoveryInterval: parseInt(process.env.DISCOVERY_INTERVAL_MS || '3600000', 10),
  firestorePath: process.env.FIRESTORE_PATH || '/artifacts/default-asset-tracker/users',
  maxRetries: 3,
  retryDelay: 2000,
};

// --- 1. FIREBASE ADMIN INITIALIZATION ---
// This service must be authenticated with a Service Account Key
// provided securely via environment variable (FIREBASE_SERVICE_ACCOUNT_KEY).

// You must convert your Service Account JSON file into a string 
// and store it in an environment variable (e.g., on Render).
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountKey) {
  console.error("FATAL: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.");
  process.exit(1);
}

let db;
try {
  const serviceAccount = JSON.parse(serviceAccountKey);
  
  // Initialize the Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // Use the same database URL if necessary, but Admin SDK typically infers it.
  });

  db = admin.firestore();
  console.log("Discovery Agent initialized successfully with Firebase Admin SDK.");
  
} catch (error) {
  console.error("FATAL: Error initializing Firebase Admin SDK:", error);
  process.exit(1);
}

// --- GRACEFUL SHUTDOWN HANDLER ---
process.on('SIGTERM', () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  if (discoveryTimer) clearInterval(discoveryTimer);
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log("SIGINT received. Shutting down gracefully...");
  if (discoveryTimer) clearInterval(discoveryTimer);
  process.exit(0);
});

let discoveryTimer = null;

// --- 2. CORE DISCOVERY FUNCTIONS ---

/**
 * Retries an async operation with exponential backoff.
 * @param {Function} operation - Async function to retry
 * @param {number} maxRetries - Maximum number of attempts
 * @returns {Promise<any>} Result of the operation
 */
async function retryWithBackoff(operation, maxRetries = CONFIG.maxRetries) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = CONFIG.retryDelay * Math.pow(2, attempt - 1);
      console.warn(`[Retry] Attempt ${attempt} failed. Retrying in ${delay}ms...`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Discovers assets for a specific customer from external APIs.
 * @param {object} customerConfig - Configuration data for the customer (e.g., AWS keys, Zendesk subdomain).
 * @returns {Promise<Array<object>>} List of discovered raw assets.
 */
async function discoverAssets(customerConfig) {
  console.log(`[Discovery] Starting scan for customer: ${customerConfig.tenantName}`);
  
  try {
    // --- PLACEHOLDER FOR ACTUAL EXTERNAL API CALLS ---
    // TODO: Implement real integrations for:
    // - AWS EC2 API
    // - Azure Resource Manager API
    // - Google Workspace Directory API
    // - Zendesk API
    // - Etc.
    
    // Example implementation structure:
    // const awsAssets = await discoverAWSAssets(customerConfig.awsKeys);
    // const azureAssets = await discoverAzureAssets(customerConfig.azureCredentials);
    // const allAssets = [...awsAssets, ...azureAssets];
    
    // For now, return mock data for demonstration
    console.log(`[Discovery] Fetching assets for ${customerConfig.tenantName}...`);
    await new Promise(resolve => setTimeout(resolve, 1000)); 

    return [
      { 
        sourceId: `SRV-${Math.floor(Math.random() * 10000)}`, 
        name: 'Web Server Alpha', 
        type: 'cloud', 
        vendor: 'AWS', 
        model: 'EC2 T3.medium', 
        user: 'system@example.com' 
      },
      { 
        sourceId: `LAP-${Math.floor(Math.random() * 10000)}`, 
        name: 'Jane Doe Laptop', 
        type: 'hardware', 
        vendor: 'Dell', 
        model: 'Latitude 7420', 
        user: 'jane.doe@example.com' 
      },
    ];
  } catch (error) {
    console.error(`[Discovery Error] Failed to discover assets for ${customerConfig.tenantName}:`, error);
    throw error;
  }
}

/**
 * Pushes normalized asset data to the customer's Firestore collection with retry logic.
 * @param {string} customerId - The ID of the customer tenant.
 * @param {Array<object>} rawAssets - The raw list of discovered assets.
 * @returns {Promise<{synced: number, failed: number}>} Sync results
 */
async function syncAssetsToFirestore(customerId, rawAssets) {
  const collectionPath = `${CONFIG.firestorePath}/${customerId}/assets`;
  const assetsCollectionRef = db.collection(collectionPath);

  console.log(`[Sync] Processing ${rawAssets.length} discovered assets for customer ${customerId}`);

  let synced = 0;
  let failed = 0;

  for (const asset of rawAssets) {
    try {
      // This is where you normalize the external data to match your Firestore schema
      const normalizedAsset = {
        asset_tag: `DISC-${asset.sourceId}`,
        serial_number: asset.sourceId,
        asset_type: asset.type,
        manufacturer: asset.vendor,
        model: asset.model,
        status: 'In Use',
        assigned_user_name: asset.user,
        cost: 0, // Placeholder
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        discovered: true,
        last_synced: new Date().toISOString()
      };

      // Use set with merge to prevent duplicates and update existing records
      const docRef = assetsCollectionRef.doc(`discovered_${asset.sourceId}`);
      
      await retryWithBackoff(async () => {
        await docRef.set(normalizedAsset, { merge: true });
      });

      synced++;
    } catch (error) {
      console.error(`[Sync Error] Failed to sync asset ${asset.sourceId}:`, error);
      failed++;
    }
  }

  console.log(`[Sync Complete] Successfully synced ${synced}/${rawAssets.length} assets for customer ${customerId}. Failed: ${failed}`);
  return { synced, failed };
}

/**
 * Fetches all active customer tenants from Firestore or environment.
 * @returns {Promise<Array<object>>} List of tenant configurations
 */
async function getActiveTenants() {
  try {
    // TODO: Implement dynamic tenant fetching from Firestore:
    // const tenantsSnapshot = await db.collection('tenants').where('active', '==', true).get();
    // return tenantsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // For now, use environment variable or fallback to mock tenant
    const tenantId = process.env.TENANT_ID || 'default_tenant';
    const tenantName = process.env.TENANT_NAME || 'Default Tenant';
    
    console.log(`[Tenants] Loaded tenant: ${tenantId}`);
    return [
      { id: tenantId, tenantName, externalConfigs: {} }
    ];
  } catch (error) {
    console.error("[Tenants Error] Failed to fetch active tenants:", error);
    throw error;
  }
}

/**
 * Main application loop to run discovery for all tenants.
 */
async function runDiscoveryCycle() {
  const cycleId = new Date().toISOString();
  console.log(`\n--- [${cycleId}] Starting Discovery Cycle ---`);
  
  try {
    // --- STEP 1: Fetch a list of all active customer tenants ---
    const tenants = await getActiveTenants();
    
    if (tenants.length === 0) {
      console.warn("[Cycle] No active tenants found. Skipping cycle.");
      return;
    }

    let totalSynced = 0;
    let totalFailed = 0;
    
    for (const tenant of tenants) {
      try {
        // --- STEP 2: Discover Assets ---
        const discoveredData = await retryWithBackoff(
          () => discoverAssets(tenant),
          CONFIG.maxRetries
        );
        
        if (discoveredData.length === 0) {
          console.log(`[Discovery] No assets discovered for tenant ${tenant.id}`);
          continue;
        }
        
        // --- STEP 3: Sync to Firestore ---
        const result = await syncAssetsToFirestore(tenant.id, discoveredData);
        totalSynced += result.synced;
        totalFailed += result.failed;
        
      } catch (error) {
        console.error(`[Cycle Error] Failed to process tenant ${tenant.id}:`, error.message);
        totalFailed++;
      }
    }

    console.log(`--- Cycle Complete [${cycleId}] - Total Synced: ${totalSynced}, Failed: ${totalFailed} ---\n`);
  } catch (error) {
    console.error("[Cycle Fatal Error]", error);
  }
}

// --- 3. SCHEDULING ---

console.log(`\n[Config] Discovery Interval: ${CONFIG.discoveryInterval}ms (${(CONFIG.discoveryInterval / 60000).toFixed(1)} minutes)`);
console.log(`[Config] Firestore Path: ${CONFIG.firestorePath}`);
console.log(`[Config] Max Retries: ${CONFIG.maxRetries}\n`);

// Run immediately and then schedule the recurring job
runDiscoveryCycle().catch(error => {
  console.error("[Startup Error] First discovery cycle failed:", error);
  process.exit(1);
});

discoveryTimer = setInterval(runDiscoveryCycle, CONFIG.discoveryInterval);
console.log("[Scheduler] Discovery cycle scheduled successfully.");