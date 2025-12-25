import React, { useState, useEffect } from 'react';
import './UsageMonitor.css';

const ForbiddenApps = () => {
  const [forbiddenApps, setForbiddenApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newApp, setNewApp] = useState({
    process_name: '',
    description: '',
    severity: 'Medium'
  });

  const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app';

  useEffect(() => {
    fetchForbiddenApps();
  }, []);

  const fetchForbiddenApps = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/forbidden-apps`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch forbidden apps');

      const data = await response.json();
      setForbiddenApps(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleAddApp = async (e) => {
    e.preventDefault();
    
    if (!newApp.process_name.trim()) {
      alert('Process name is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/forbidden-apps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newApp)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add forbidden app');
      }

      const added = await response.json();
      setForbiddenApps([...forbiddenApps, added]);
      setNewApp({ process_name: '', description: '', severity: 'Medium' });
      setShowAddForm(false);
      alert(`✅ Added: ${added.process_name}`);
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  const handleDeleteApp = async (id, processName) => {
    if (!window.confirm(`Delete "${processName}" from forbidden list?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/forbidden-apps/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete forbidden app');

      setForbiddenApps(forbiddenApps.filter(app => app.id !== id));
      alert(`✅ Removed: ${processName}`);
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'Low': '#10b981',
      'Medium': '#f59e0b',
      'High': '#ef4444',
      'Critical': '#dc2626'
    };
    return colors[severity] || '#6b7280';
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <h2>⏳ Loading forbidden apps...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <h2>❌ Error</h2>
        <p>{error}</p>
        <button onClick={fetchForbiddenApps}>🔄 Retry</button>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>🚫 Forbidden Applications</h2>
        <button 
          className="add-button"
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ padding: '8px 16px', fontSize: '14px' }}
        >
          {showAddForm ? '❌ Cancel' : '➕ Add New'}
        </button>
      </div>

      {showAddForm && (
        <div className="add-form" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '20px'
        }}>
          <form onSubmit={handleAddApp}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#fff' }}>
                Process Name *
              </label>
              <input
                type="text"
                placeholder="e.g., poker.exe, torrent.exe"
                value={newApp.process_name}
                onChange={(e) => setNewApp({ ...newApp, process_name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#fff' }}>
                Description
              </label>
              <input
                type="text"
                placeholder="Why is this app forbidden?"
                value={newApp.description}
                onChange={(e) => setNewApp({ ...newApp, description: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#fff' }}>
                Severity Level
              </label>
              <select
                value={newApp.severity}
                onChange={(e) => setNewApp({ ...newApp, severity: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '14px'
                }}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <button
              type="submit"
              style={{
                padding: '10px 20px',
                backgroundColor: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              ✅ Add to Forbidden List
            </button>
          </form>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{forbiddenApps.length}</div>
          <div className="stat-label">Total Forbidden Apps</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {forbiddenApps.filter(a => a.severity === 'Critical').length}
          </div>
          <div className="stat-label">Critical</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {forbiddenApps.filter(a => a.severity === 'High').length}
          </div>
          <div className="stat-label">High</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {forbiddenApps.filter(a => a.severity === 'Medium').length}
          </div>
          <div className="stat-label">Medium</div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Process Name</th>
              <th>Description</th>
              <th>Severity</th>
              <th>Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {forbiddenApps.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>
                  ℹ️ No forbidden apps configured
                </td>
              </tr>
            ) : (
              forbiddenApps.map((app) => (
                <tr key={app.id}>
                  <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>
                    {app.process_name}
                  </td>
                  <td>{app.description || '-'}</td>
                  <td>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: '#fff',
                        backgroundColor: getSeverityColor(app.severity)
                      }}
                    >
                      {app.severity}
                    </span>
                  </td>
                  <td>{new Date(app.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => handleDeleteApp(app.id, app.process_name)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ForbiddenApps;
