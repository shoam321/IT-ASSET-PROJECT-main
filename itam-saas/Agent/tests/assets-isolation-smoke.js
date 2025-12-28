/**
 * Assets Isolation Smoke Test (API-level)
 *
 * Goal: Fail fast if a non-admin user can see assets that are not assigned to them.
 *
 * Modes:
 * - read-only (default for non-local URLs):
 *     Uses an existing user token and verifies GET /assets only returns rows for that user.
 * - full (recommended for local/dev):
 *     Logs in as admin, creates two users + assets, asserts isolation, then deletes created assets.
 *
 * Usage (local, full):
 *   API_BASE_URL=http://localhost:5000/api MODE=full ADMIN_USERNAME=admin ADMIN_PASSWORD=admin123 node tests/assets-isolation-smoke.js
 *
 * Usage (prod, read-only):
 *   API_BASE_URL=https://<host>/api MODE=read-only TEST_USER_TOKEN=<jwt> node tests/assets-isolation-smoke.js
 */

const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const MODE = String(process.env.MODE || '').trim().toLowerCase();

function isLocalApi(baseUrl) {
  try {
    const u = new URL(baseUrl);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function defaultMode() {
  if (MODE === 'full' || MODE === 'read-only') return MODE;
  return isLocalApi(API_BASE_URL) ? 'full' : 'read-only';
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(method, path, { token, body } = {}) {
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg = typeof json?.error === 'string' ? json.error : `HTTP ${res.status}`;
    throw new Error(`${method} ${path} failed: ${msg}`);
  }

  return json;
}

async function login(username, password) {
  const data = await request('POST', '/auth/login', {
    body: { username, password }
  });
  assert(typeof data?.token === 'string' && data.token.length > 20, 'Login did not return a token');
  assert(typeof data?.user?.id === 'number', 'Login did not return user.id');
  return data;
}

async function register(username, email, password) {
  const data = await request('POST', '/auth/register', {
    body: { username, email, password }
  });
  assert(typeof data?.token === 'string' && data.token.length > 20, 'Register did not return a token');
  assert(typeof data?.user?.id === 'number', 'Register did not return user.id');
  return data;
}

async function createAsset(adminToken, asset) {
  const created = await request('POST', '/assets', { token: adminToken, body: asset });
  assert(typeof created?.id === 'number', 'Asset create did not return id');
  return created;
}

async function deleteAsset(adminToken, id) {
  await request('DELETE', `/assets/${id}`, { token: adminToken });
}

function pickDefaultAdminCreds() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  return { username, password };
}

function uniqueSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

async function main() {
  console.log(`🔎 Assets isolation smoke test`);
  console.log(`API_BASE_URL=${API_BASE_URL}`);

  const mode = defaultMode();
  console.log(`MODE=${mode}`);

  if (mode === 'read-only') {
    const userToken = process.env.TEST_USER_TOKEN;
    assert(typeof userToken === 'string' && userToken.length > 20, 'TEST_USER_TOKEN is required in read-only mode');

    const me = await request('GET', '/auth/me', { token: userToken });
    assert(typeof me?.id === 'number', 'GET /auth/me did not return id');

    const assets = await request('GET', '/assets', { token: userToken });
    assert(Array.isArray(assets), 'GET /assets should return an array');

    // Strict: every returned asset must belong to current user.
    const foreign = assets.filter(a => a?.user_id !== me.id);
    assert(foreign.length === 0, `User can see assets not owned by them (found ${foreign.length})`);

    console.log(`✅ PASS: read-only isolation (userId=${me.id}, assets=${assets.length})`);
    return;
  }

  // FULL mode: creates temporary users/assets for deterministic assertions.
  // Guard: require explicit opt-in if pointing at a non-local API.
  if (!isLocalApi(API_BASE_URL) && process.env.ALLOW_NONLOCAL_FULL_TESTS !== 'true') {
    throw new Error('Refusing to run MODE=full against a non-local API. Set ALLOW_NONLOCAL_FULL_TESTS=true to override.');
  }

  const suffix = uniqueSuffix();

  const alice = {
    username: `mt_alice_${suffix}`,
    email: `alice.${suffix}@example.com`,
    password: `Alice-${suffix}!`
  };
  const bob = {
    username: `mt_bob_${suffix}`,
    email: `bob.${suffix}@example.com`,
    password: `Bob-${suffix}!`
  };

  const { username: adminUsername, password: adminPassword } = pickDefaultAdminCreds();

  let adminLogin;
  try {
    adminLogin = await login(adminUsername, adminPassword);
  } catch (e) {
    throw new Error(
      `Admin login failed. Set ADMIN_USERNAME/ADMIN_PASSWORD for a real admin account. Details: ${e.message}`
    );
  }

  const adminToken = adminLogin.token;
  const adminId = adminLogin.user.id;

  const aliceReg = await register(alice.username, alice.email, alice.password);
  const bobReg = await register(bob.username, bob.email, bob.password);

  const aliceId = aliceReg.user.id;
  const bobId = bobReg.user.id;

  const aliceLogin = await login(alice.username, alice.password);
  const bobLogin = await login(bob.username, bob.password);

  const aliceToken = aliceLogin.token;
  const bobToken = bobLogin.token;

  const tags = {
    alice: `MT-ASSET-ALICE-${suffix}`,
    bob: `MT-ASSET-BOB-${suffix}`,
    admin: `MT-ASSET-ADMIN-${suffix}`
  };

  const createdAssetIds = [];
  try {
    const aliceAsset = await createAsset(adminToken, {
      asset_tag: tags.alice,
      asset_type: 'Laptop',
      manufacturer: 'TestCo',
      model: 'AliceBook',
      status: 'In Use',
      user_id: aliceId
    });
    createdAssetIds.push(aliceAsset.id);

    const bobAsset = await createAsset(adminToken, {
      asset_tag: tags.bob,
      asset_type: 'Laptop',
      manufacturer: 'TestCo',
      model: 'BobBook',
      status: 'In Use',
      user_id: bobId
    });
    createdAssetIds.push(bobAsset.id);

    const adminAsset = await createAsset(adminToken, {
      asset_tag: tags.admin,
      asset_type: 'Laptop',
      manufacturer: 'TestCo',
      model: 'AdminBook',
      status: 'In Use',
      user_id: adminId
    });
    createdAssetIds.push(adminAsset.id);

    // Fetch assets as Alice
    const aliceAssets = await request('GET', '/assets', { token: aliceToken });
    assert(Array.isArray(aliceAssets), 'GET /assets should return an array');
    assert(aliceAssets.some(a => a.asset_tag === tags.alice), 'Alice did not receive her asset');
    assert(!aliceAssets.some(a => a.asset_tag === tags.bob), 'Alice can see Bob\'s asset');
    assert(!aliceAssets.some(a => a.asset_tag === tags.admin), 'Alice can see Admin\'s asset');
    assert(aliceAssets.every(a => a.user_id === aliceId), 'Alice received an asset with a different user_id');

    // Fetch assets as Bob
    const bobAssets = await request('GET', '/assets', { token: bobToken });
    assert(Array.isArray(bobAssets), 'GET /assets should return an array');
    assert(bobAssets.some(a => a.asset_tag === tags.bob), 'Bob did not receive his asset');
    assert(!bobAssets.some(a => a.asset_tag === tags.alice), 'Bob can see Alice\'s asset');
    assert(!bobAssets.some(a => a.asset_tag === tags.admin), 'Bob can see Admin\'s asset');
    assert(bobAssets.every(a => a.user_id === bobId), 'Bob received an asset with a different user_id');

    // Search should be scoped too
    const aliceSearch = await request('GET', `/assets/search/${encodeURIComponent('MT-ASSET')}`, { token: aliceToken });
    assert(Array.isArray(aliceSearch), 'GET /assets/search should return an array');
    assert(aliceSearch.some(a => a.asset_tag === tags.alice), 'Alice search did not include her asset');
    assert(!aliceSearch.some(a => a.asset_tag === tags.bob), 'Alice search includes Bob\'s asset');
    assert(!aliceSearch.some(a => a.asset_tag === tags.admin), 'Alice search includes Admin\'s asset');

    console.log('✅ PASS: Assets are isolated per-user (API-level)');
  } finally {
    // Best-effort cleanup
    for (const id of createdAssetIds) {
      try {
        await deleteAsset(adminToken, id);
      } catch {
        // ignore
      }
    }
  }
}

main().catch((err) => {
  console.error(`❌ FAIL: ${err.message}`);
  process.exit(1);
});
