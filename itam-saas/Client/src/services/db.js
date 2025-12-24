// Database service for React frontend
const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';

/**
 * Get authorization headers with JWT token
 */
function getAuthHeaders() {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
}

/**
 * Handle API response and check for auth errors
 */
async function handleResponse(response) {
  if (response.status === 401) {
    // Token expired or invalid - logout user
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    window.location.reload();
    throw new Error('Session expired. Please login again.');
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }
  
  return response.json();
}

/**
 * Fetch all assets from server
 */
export async function fetchAssets() {
  try {
    const response = await fetch(`${API_URL}/assets`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching assets:', error);
    throw error;
  }
}

/**
 * Search assets
 */
export async function searchAssets(query) {
  try {
    const response = await fetch(`${API_URL}/assets/search/${encodeURIComponent(query)}`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error searching assets:', error);
    throw error;
  }
}

/**
 * Get asset by ID
 */
export async function getAssetById(id) {
  try {
    const response = await fetch(`${API_URL}/assets/${id}`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching asset:', error);
    throw error;
  }
}

/**
 * Create new asset
 */
export async function createAsset(assetData) {
  try {
    const response = await fetch(`${API_URL}/assets`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(assetData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error creating asset:', error);
    throw error;
  }
}

/**
 * Update asset
 */
export async function updateAsset(id, assetData) {
  try {
    const response = await fetch(`${API_URL}/assets/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(assetData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error updating asset:', error);
    throw error;
  }
}

/**
 * Delete asset
 */
export async function deleteAsset(id) {
  try {
    const response = await fetch(`${API_URL}/assets/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error deleting asset:', error);
    throw error;
  }
}

/**
 * Get asset statistics
 */
export async function getAssetStats() {
  try {
    const statsUrl = `${API_URL.replace('/api', '')}/stats`;
    const response = await fetch(statsUrl);
    if (!response.ok) throw new Error('Failed to fetch stats');
    return await response.json();
  } catch (error) {
    console.error('Error fetching stats:', error);
    throw error;
  }
}

// ============ LICENSES FUNCTIONS ============

/**
 * Fetch all licenses from server
 */
export async function fetchLicenses() {
  try {
    const response = await fetch(`${API_URL}/licenses`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching licenses:', error);
    throw error;
  }
}

/**
 * Search licenses
 */
export async function searchLicenses(query) {
  try {
    const response = await fetch(`${API_URL}/licenses/search/${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search licenses');
    return await response.json();
  } catch (error) {
    console.error('Error searching licenses:', error);
    throw error;
  }
}

/**
 * Create new license
 */
export async function createLicense(licenseData) {
  try {
    const response = await fetch(`${API_URL}/licenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(licenseData),
    });
    if (!response.ok) throw new Error('Failed to create license');
    return await response.json();
  } catch (error) {
    console.error('Error creating license:', error);
    throw error;
  }
}

/**
 * Update license
 */
export async function updateLicense(id, licenseData) {
  try {
    const response = await fetch(`${API_URL}/licenses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(licenseData),
    });
    if (!response.ok) throw new Error('Failed to update license');
    return await response.json();
  } catch (error) {
    console.error('Error updating license:', error);
    throw error;
  }
}

/**
 * Delete license
 */
export async function deleteLicense(id) {
  try {
    const response = await fetch(`${API_URL}/licenses/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete license');
    return await response.json();
  } catch (error) {
    console.error('Error deleting license:', error);
    throw error;
  }
}

// ============ USERS FUNCTIONS ============

/**
 * Fetch all users from server
 */
export async function fetchUsers() {
  try {
    const response = await fetch(`${API_URL}/users`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

/**
 * Search users
 */
export async function searchUsers(query) {
  try {
    const response = await fetch(`${API_URL}/users/search/${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search users');
    return await response.json();
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
}

/**
 * Create new user
 */
export async function createUser(userData) {
  try {
    const response = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (!response.ok) throw new Error('Failed to create user');
    return await response.json();
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

/**
 * Update user
 */
export async function updateUser(id, userData) {
  try {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (!response.ok) throw new Error('Failed to update user');
    return await response.json();
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

/**
 * Delete user
 */
export async function deleteUser(id) {
  try {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete user');
    return await response.json();
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

// ============ CONTRACTS FUNCTIONS ============

/**
 * Fetch all contracts from server
 */
export async function fetchContracts() {
  try {
    const response = await fetch(`${API_URL}/contracts`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching contracts:', error);
    throw error;
  }
}

/**
 * Search contracts
 */
export async function searchContracts(query) {
  try {
    const response = await fetch(`${API_URL}/contracts/search/${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search contracts');
    return await response.json();
  } catch (error) {
    console.error('Error searching contracts:', error);
    throw error;
  }
}

/**
 * Create new contract
 */
export async function createContract(contractData) {
  try {
    const response = await fetch(`${API_URL}/contracts`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(contractData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error creating contract:', error);
    throw error;
  }
}

/**
 * Update contract
 */
export async function updateContract(id, contractData) {
  try {
    const response = await fetch(`${API_URL}/contracts/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(contractData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error updating contract:', error);
    throw error;
  }
}

/**
 * Delete contract
 */
export async function deleteContract(id) {
  try {
    const response = await fetch(`${API_URL}/contracts/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error deleting contract:', error);
    throw error;
  }
}
