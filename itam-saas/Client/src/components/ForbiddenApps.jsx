import React, { useState, useEffect } from 'react';
import { Shield, Plus, X, Trash2, Search, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import './UsageMonitor.css';

const ForbiddenApps = () => {
  const [forbiddenApps, setForbiddenApps] = useState([]);
  const [filteredApps, setFilteredApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [formErrors, setFormErrors] = useState({});
  const [newApp, setNewApp] = useState({
    process_name: '',
    description: '',
    severity: 'Medium'
  });

  const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app';

  useEffect(() => {
    fetchForbiddenApps();
  }, []);

  useEffect(() => {
    // Filter apps based on search and severity
    let filtered = forbiddenApps;
    
    if (searchTerm) {
      filtered = filtered.filter(app => 
        app.process_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (app.description && app.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    if (filterSeverity !== 'All') {
      filtered = filtered.filter(app => app.severity === filterSeverity);
    }
    
    setFilteredApps(filtered);
  }, [forbiddenApps, searchTerm, filterSeverity]);

  const showSuccessMessage = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const validateForm = () => {
    const errors = {};
    
    if (!newApp.process_name.trim()) {
      errors.process_name = 'Process name is required';
    } else if (!/^[a-zA-Z0-9._-]+\.(exe|app|bin|sh|bat|cmd|msi)$/i.test(newApp.process_name.trim())) {
      errors.process_name = 'Enter a valid executable name (e.g., poker.exe, steam.app)';
    }
    
    if (forbiddenApps.some(app => app.process_name.toLowerCase() === newApp.process_name.trim().toLowerCase())) {
      errors.process_name = 'This app is already in the forbidden list';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const fetchForbiddenApps = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/forbidden-apps`, {
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
    
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/forbidden-apps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newApp,
          process_name: newApp.process_name.trim().toLowerCase()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add forbidden app');
      }

      const added = await response.json();
      setForbiddenApps([added, ...forbiddenApps]);
      setNewApp({ process_name: '', description: '', severity: 'Medium' });
      setFormErrors({});
      setShowAddForm(false);
      showSuccessMessage(`Successfully added "${added.process_name}" to forbidden list`);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteApp = async (id, processName) => {
    if (!window.confirm(`Are you sure you want to remove "${processName}" from the forbidden list?\n\nThis will allow the application to run on monitored devices.`)) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/forbidden-apps/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete forbidden app');

      setForbiddenApps(forbiddenApps.filter(app => app.id !== id));
      showSuccessMessage(`Removed "${processName}" from forbidden list`);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'Low': '#10b981',
      'Medium': '#f59e0b',
      'High': '#ef4444',
      'Critical': '#dc2626'
  const severityInfo = {
    'Critical': { icon: '🔴', desc: 'Severe security threat or policy violation', color: '#dc2626' },
    'High': { icon: '🟠', desc: 'Significant risk or policy concern', color: '#ef4444' },
    'Medium': { icon: '🟡', desc: 'Moderate policy violation', color: '#f59e0b' },
    'Low': { icon: '🟢', desc: 'Minor policy or productivity concern', color: '#10b981' }
  };     <p>{error}</p>
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
        > style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div className="dashboard-header" style={{ marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Shield size={32} style={{ color: '#ef4444' }} />
            <h2 style={{ margin: 0, fontSize: '28px' }}>Forbidden Applications</h2>
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
            Manage applications that are not allowed to run on monitored devices
          </p>
        </div>
        <button 
          className="add-button"
          onClick={() => {
            setShowAddForm(!showAddForm);
       /* Add Form */}
      {showAddForm && (
        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          animation: 'slideIn 0.3s ease-out'
        }}>
          <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>
            Add New Forbidden Application
          </h3>
          <form onSubmit={handleAddApp}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontSize: '14px', fontWeight: '600' }}>
                Process Name <span style={{ color: '#fca5a5' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., poker.exe, steam.exe, torrent.app"
                value={newApp.process_name}
                onChange={(e) => {
                  setNewApp({ ...newApp, process_name: e.target.value });
                  setFormErrors({ ...formErrors, process_name: '' });
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: formErrors.process_name ? '2px solid #fca5a5' : '1px solid #e2e8f0',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
              />
              {formErrors.process_name && (
                <p style={{ color: '#fca5a5', fontSize: '12px', marginTop: '4px', marginBottom: 0 }}>
                  {formErrors.process_name}
                </p>
              )}
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', marginTop: '4px', marginBottom: 0 }}>
                <Info size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Enter the exact executable name (case-insensitive)
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontSize: '14px', fontWeight: '600' }}>
                Description
              </label>
              <textarea
                placeholder="Explain why this application is forbidden..."
                value={newApp.description}
                onChange={(e) => setNewApp({ ...newApp, description: e.target.value })}
                rows="3"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#fff', fontSize: '14px', fontWeight: '600' }}>
                Severity Level
              </label>
              <select
                value={newApp.severity}
                onChange={(e) => setNewApp({ ...newApp, severity: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
      {/* Stats Grid */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}>
          <div className="stat-value" style={{ color: '#fff' }}>{forbiddenApps.length}</div>
          <div className="stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Total Forbidden Apps</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)' }}>
          <div className="stat-value" style={{ color: '#fff' }}>
            {forbiddenApps.filter(a => a.severity === 'Critical').length}
          </div>
          <div className="stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>🔴 Critical</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
          <div className="stat-value" style={{ color: '#fff' }}>
            {forbiddenApps.filter(a => a.severity === 'High').length}
          </div>
          <div className="stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>🟠 High</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
          <div className="stat-value" style={{ color: '#fff' }}>
            {forbiddenApps.filter(a => a.severity === 'Medium').length}
          </div>
          <div className="stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>🟡 Medium</div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
          <Search size={18} style={{ 
            position: 'absolute', 
            left: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: '#94a3b8'
          }} />
          <input
            type="text"
            placeholder="Search by process name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 12px 12px 40px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '14px'
            }}
          />
        </div>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            fontSize: '14px',
            cursor: 'pointer',
            minWidth: '150px'
          }}
        >
          <option value="All">All Severities</option>
          <option value="Critical">🔴 Critical</option>
          <option value="High">🟠 High</option>
          <option value="Medium">🟡 Medium</option>
          <option value="Low">🟢 Low</option>
        </select>
        {(searchTerm || filterSeverity !== 'All') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterSeverity('All');
            }}
            style={{
              padding: '12px 16px',
              backgroundColor: '#64748b',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
      {/* Table */}
      <div className="table-container" style={{ 
        background: '#fff', 
        borderRadius: '12px', 
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        {loading && !forbiddenApps.length ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <p style={{ margin: 0, fontSize: '16px' }}>Loading forbidden applications...</p>
          </div>
        ) : filteredApps.length === 0 && searchTerm ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <Search size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: '16px' }}>No applications match your search</p>
            <button
              onClick={() => setSearchTerm('')}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Clear Search
            </button>
          </div>
        ) : forbiddenApps.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <Shield size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: '16px', marginBottom: '8px' }}>No forbidden apps configured yet</p>
            <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>
              Click "Add Application" to start building your forbidden apps list
            </p>
          </div>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Process Name</th>
                <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Description</th>
                <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Severity</th>
                <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Added</th>
                <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApps.map((app, index) => (
                <tr 
                  key={app.id}
                  style={{
                    borderBottom: index !== filteredApps.length - 1 ? '1px solid #e2e8f0' : 'none',
                    backgroundColor: index % 2 === 0 ? '#fff' : '#f8fafc',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f8fafc'}
                >
                  <td style={{ padding: '16px', fontWeight: '600', fontFamily: 'monospace', fontSize: '14px', color: '#1e293b' }}>
                    {app.process_name}
                  </td>
                  <td style={{ padding: '16px', color: '#64748b', fontSize: '14px' }}>
                    {app.description || <span style={{ fontStyle: 'italic', color: '#cbd5e1' }}>No description</span>}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span
                      style={{
                        padding: '6px 12px',
                        borderRadius: '16px',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#fff',
                        backgroundColor: getSeverityColor(app.severity),
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {severityInfo[app.severity]?.icon} {app.severity}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: '#64748b', fontSize: '14px' }}>
                    {new Date(app.created_at).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleDeleteApp(app.id, app.process_name)}
                      disabled={loading}
                      style={{
                        padding: '8px 14px',
                        backgroundColor: loading ? '#cbd5e1' : '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#dc2626')}
                      onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#ef4444')}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Results count */}
      {filteredApps.length > 0 && (
        <div style={{ 
          marginTop: '16px', 
          textAlign: 'center', 
          color: '#64748b', 
          fontSize: '14px' 
        }}>
          Showing {filteredApps.length} of {forbiddenApps.length} application{forbiddenApps.length !== 1 ? 's' : ''}
        </div>
      )}    backgroundColor: '#10b981',
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
