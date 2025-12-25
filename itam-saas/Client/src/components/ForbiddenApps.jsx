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
    };
    return colors[severity] || '#6b7280';
  };

  const severityInfo = {
    'Critical': { icon: '🔴', desc: 'Severe security threat or policy violation' },
    'High': { icon: '🟠', desc: 'Significant risk or policy concern' },
    'Medium': { icon: '🟡', desc: 'Moderate policy violation' },
    'Low': { icon: '🟢', desc: 'Minor policy or productivity concern' }
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: '1400px', margin: '0 auto' }}>
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
            setFormErrors({});
            if (!showAddForm) {
              setNewApp({ process_name: '', description: '', severity: 'Medium' });
            }
          }}
          style={{ 
            padding: '12px 20px', 
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: showAddForm ? '#64748b' : '#3b82f6',
            fontWeight: '600'
          }}
        >
          {showAddForm ? (
            <><X size={18} /> Cancel</>
          ) : (
            <><Plus size={18} /> Add Application</>
          )}
        </button>
      </div>

      {successMessage && (
        <div style={{
          backgroundColor: '#dcfce7',
          border: '1px solid #86efac',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <CheckCircle size={20} style={{ color: '#16a34a', flexShrink: 0 }} />
          <span style={{ color: '#166534', fontSize: '14px' }}>{successMessage}</span>
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertTriangle size={20} style={{ color: '#dc2626', flexShrink: 0 }} />
          <span style={{ color: '#991b1b', fontSize: '14px' }}>{error}</span>
        </div>
      )}

      {showAddForm && (
        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
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
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {Object.entries(severityInfo).map(([level, info]) => (
                  <option key={level} value={level}>
                    {info.icon} {level} - {info.desc}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 24px',
                backgroundColor: loading ? '#94a3b8' : '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {loading ? '⏳ Adding...' : <><CheckCircle size={18} /> Add to Forbidden List</>}
            </button>
          </form>
        </div>
      )}

      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}>
          <div className="stat-value" style={{ color: '#fff' }}>{forbiddenApps.length}</div>
          <div className="stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Total Apps</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)' }}>
          <div className="stat-value" style={{ color: '#fff' }}>
            {forbiddenApps.filter(a => a.severity === 'Critical').length}
          </div>
          <div className="stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Critical</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
          <div className="stat-value" style={{ color: '#fff' }}>
            {forbiddenApps.filter(a => a.severity === 'High').length}
          </div>
          <div className="stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>High</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
          <div className="stat-value" style={{ color: '#fff' }}>
            {forbiddenApps.filter(a => a.severity === 'Medium').length}
          </div>
          <div className="stat-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Medium</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
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
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
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
              fontSize: '14px'
            }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="table-container" style={{ 
        background: '#fff', 
        borderRadius: '12px', 
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        {loading && !forbiddenApps.length ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <p style={{ margin: 0 }}>Loading forbidden applications...</p>
          </div>
        ) : forbiddenApps.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <Shield size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p style={{ margin: 0 }}>No forbidden apps configured yet</p>
          </div>
        ) : (
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '16px', textAlign: 'left' }}>Process Name</th>
                <th style={{ padding: '16px', textAlign: 'left' }}>Description</th>
                <th style={{ padding: '16px', textAlign: 'left' }}>Severity</th>
                <th style={{ padding: '16px', textAlign: 'left' }}>Added</th>
                <th style={{ padding: '16px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApps.map((app) => (
                <tr key={app.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '16px', fontWeight: '600', fontFamily: 'monospace' }}>
                    {app.process_name}
                  </td>
                  <td style={{ padding: '16px', color: '#64748b' }}>
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
                        backgroundColor: getSeverityColor(app.severity)
                      }}
                    >
                      {severityInfo[app.severity]?.icon} {app.severity}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: '#64748b' }}>
                    {new Date(app.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleDeleteApp(app.id, app.process_name)}
                      disabled={loading}
                      style={{
                        padding: '8px 14px',
                        backgroundColor: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
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

      {filteredApps.length > 0 && (
        <div style={{ marginTop: '16px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
          Showing {filteredApps.length} of {forbiddenApps.length} application{forbiddenApps.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default ForbiddenApps;
