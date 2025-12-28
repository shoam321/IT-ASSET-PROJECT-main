import React, { useState, useEffect } from 'react';
import { Clock, User, FileEdit, Trash2, PlusCircle, Filter } from 'lucide-react';
import InfoButton from './InfoButton';

const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';

export default function AuditTrail() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    table: '',
    action: '',
    startDate: '',
    endDate: '',
    limit: 100
  });
  const [appliedFilters, setAppliedFilters] = useState({
    table: '',
    action: '',
    startDate: '',
    endDate: '',
    limit: 100
  });

  useEffect(() => {
    fetchAuditLogs();
  }, [appliedFilters]);

  const getFilenameFromDisposition = (contentDisposition, fallback) => {
    if (!contentDisposition) return fallback;
    const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition);
    const filename = decodeURIComponent(match?.[1] || match?.[2] || '');
    return filename || fallback;
  };

  const downloadAuditExport = async (format) => {
    try {
      setError(null);
      const token = localStorage.getItem('authToken');

      const queryParams = new URLSearchParams();
      queryParams.append('format', format);
      if (appliedFilters.table) queryParams.append('table', appliedFilters.table);
      if (appliedFilters.action) queryParams.append('action', appliedFilters.action);
      if (appliedFilters.startDate) queryParams.append('startDate', appliedFilters.startDate);
      if (appliedFilters.endDate) queryParams.append('endDate', appliedFilters.endDate);
      if (appliedFilters.limit) queryParams.append('limit', appliedFilters.limit);

      const response = await fetch(`${API_URL}/audit-logs/export?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Session expired. Please login again.');
        }
        throw new Error('Failed to export audit logs');
      }

      const blob = await response.blob();
      const fallbackName = `audit-logs.${format === 'json' ? 'json' : 'csv'}`;
      const filename = getFilenameFromDisposition(response.headers.get('content-disposition'), fallbackName);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Audit export error:', err);
      setError(err.message);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      const queryParams = new URLSearchParams();
      if (appliedFilters.table) queryParams.append('table', appliedFilters.table);
      if (appliedFilters.action) queryParams.append('action', appliedFilters.action);
      if (appliedFilters.startDate) queryParams.append('startDate', appliedFilters.startDate);
      if (appliedFilters.endDate) queryParams.append('endDate', appliedFilters.endDate);
      queryParams.append('limit', appliedFilters.limit);

      const response = await fetch(`${API_URL}/audit-logs?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Session expired. Please login again.');
        }
        throw new Error('Failed to fetch audit logs');
      }

      const data = await response.json();
      setAuditLogs(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) {
      console.error('Audit log fetch error:', err);
      setError(err.message);
      setAuditLogs([]);
      setLoading(false);
    }
  };

  const handleFilter = (e) => {
    e.preventDefault();
    setAppliedFilters({...filters});
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'CREATE': return <PlusCircle size={16} className="text-green-500" />;
      case 'UPDATE': return <FileEdit size={16} className="text-blue-500" />;
      case 'DELETE': return <Trash2 size={16} className="text-red-500" />;
      case 'LOGIN': return <User size={16} className="text-slate-600" />;
      case 'LOGOUT': return <User size={16} className="text-slate-600" />;
      default: return null;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800';
      case 'UPDATE': return 'bg-blue-100 text-blue-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      case 'LOGIN': return 'bg-slate-100 text-slate-800';
      case 'LOGOUT': return 'bg-slate-100 text-slate-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getDiff = (oldData, newData) => {
    if (!oldData || !newData) return null;
    
    const changes = [];
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    
    allKeys.forEach(key => {
      if (oldData[key] !== newData[key]) {
        changes.push({
          field: key,
          from: oldData[key],
          to: newData[key]
        });
      }
    });
    
    return changes;
  };

  const getUserDisplay = (log) => {
    const name = log.user_full_name || log.username;
    const email = log.user_email;
    if (!name && !email) return 'System';
    if (name && email) return `${name} (${email})`;
    return name || email;
  };

  const normalizeJson = (value) => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return null;
  };

  const getEntitySummary = (log) => {
    const newData = normalizeJson(log.new_data);
    const oldData = normalizeJson(log.old_data);
    const data = newData || oldData;
    if (!data) return null;

    switch (log.table_name) {
      case 'forbidden_apps': {
        const name = data.process_name || data.app_detected || data.name;
        const sev = data.severity;
        const desc = data.description;
        const parts = [];
        if (name) parts.push(String(name));
        if (sev) parts.push(String(sev));
        const title = parts.length ? parts.join(' • ') : 'Forbidden app';
        return desc ? `${title} — ${String(desc)}` : title;
      }
      case 'assets': {
        const tag = data.asset_tag;
        const type = data.asset_type;
        if (tag && type) return `${tag} • ${type}`;
        return tag || type || 'Asset';
      }
      case 'licenses': {
        return data.license_name || data.vendor || 'License';
      }
      case 'contracts': {
        return data.contract_name || data.vendor || 'Contract';
      }
      case 'users': {
        return data.username || data.email || 'User';
      }
      default: {
        // Fallback: try a couple common fields.
        return data.name || data.title || data.process_name || null;
      }
    }
  };

  if (loading) {
    return (
      <div className="audit-trail-container" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
        Loading audit logs...
      </div>
    );
  }

  if (error) {
    return (
      <div className="audit-trail-container" style={{ padding: '40px' }}>
        <div style={{ background: '#fee', padding: '20px', borderRadius: '8px', color: '#c00' }}>
          ❌ Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="audit-trail-container" style={{ padding: '20px' }}>
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>
            📜 Audit Trail
          </h1>
          <InfoButton
            title="Audit Trail"
            description="The Audit Trail keeps a complete record of every change made in your system. Think of it as a security camera for your data - it shows who did what, when they did it, and what changed."
            examples={[
              "See who created, updated, or deleted assets, licenses, users, and contracts",
              "View before and after values for every change (what it was vs. what it became)",
              "Filter by date range to find changes during specific time periods",
              "Track user activity for compliance audits and security investigations",
              "Identify when and why data was modified for troubleshooting"
            ]}
          />
        </div>
        <p style={{ color: '#64748b' }}>
          Complete history of all system changes for compliance and security
        </p>
      </div>

      {/* Filters */}
      <form onSubmit={handleFilter} style={{ 
        background: 'white', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
              <Filter size={16} style={{ display: 'inline', marginRight: '5px' }} />
              Table
            </label>
            <select 
              value={filters.table}
              onChange={(e) => setFilters({...filters, table: e.target.value})}
              style={{ 
                width: '100%', 
                padding: '8px', 
                borderRadius: '4px', 
                border: '1px solid #ddd' 
              }}
            >
              <option value="">All Tables</option>
              <option value="assets">Assets</option>
              <option value="licenses">Licenses</option>
              <option value="users">Users</option>
              <option value="contracts">Contracts</option>
              <option value="forbidden_apps">Forbidden Apps</option> {/* New option */}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Action</label>
            <select 
              value={filters.action}
              onChange={(e) => setFilters({...filters, action: e.target.value})}
              style={{ 
                width: '100%', 
                padding: '8px', 
                borderRadius: '4px', 
                border: '1px solid #ddd' 
              }}
            >
              <option value="">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Start Date</label>
            <input 
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              style={{ 
                width: '100%', 
                padding: '8px', 
                borderRadius: '4px', 
                border: '1px solid #ddd' 
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>End Date</label>
            <input 
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              style={{ 
                width: '100%', 
                padding: '8px', 
                borderRadius: '4px', 
                border: '1px solid #ddd' 
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <button 
            type="submit"
            style={{
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Apply Filters
          </button>
          <button 
            type="button"
            onClick={() => {
              setFilters({
                table: '',
                action: '',
                startDate: '',
                endDate: '',
                limit: 100
              });
              setAppliedFilters({
                table: '',
                action: '',
                startDate: '',
                endDate: '',
                limit: 100
              });
            }}
            style={{
              padding: '10px 20px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Clear Filters
          </button>

          <button
            type="button"
            onClick={() => downloadAuditExport('csv')}
            style={{
              padding: '10px 20px',
              background: '#0f172a',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => downloadAuditExport('json')}
            style={{
              padding: '10px 20px',
              background: '#0f172a',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Export JSON
          </button>
        </div>
      </form>

      {/* Audit Logs Table */}
      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>
                <Clock size={16} style={{ display: 'inline', marginRight: '5px' }} />
                Timestamp
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Action</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Table</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Record ID</th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>
                <User size={16} style={{ display: 'inline', marginRight: '5px' }} />
                User
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Changes</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  No audit logs found
                </td>
              </tr>
            ) : (
              auditLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px' }}>{formatTimestamp(log.timestamp)}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }} className={getActionColor(log.action)}>
                      {getActionIcon(log.action)}
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontWeight: '500' }}>{log.table_name}</td>
                  <td style={{ padding: '12px', fontFamily: 'monospace' }}>#{log.record_id}</td>
                  <td style={{ padding: '12px' }}>{getUserDisplay(log)}</td>
                  <td style={{ padding: '12px', fontSize: '12px', color: '#64748b' }}>
                    <div>
                      {(() => {
                        const summary = getEntitySummary(log);
                        return summary ? (
                        <div style={{ marginBottom: '6px', color: '#0f172a' }}>
                          <strong>{summary}</strong>
                        </div>
                        ) : null;
                      })()}

                      {log.action === 'UPDATE' ? (
                        <div>
                          {getDiff(normalizeJson(log.old_data), normalizeJson(log.new_data))
                            ?.slice(0, 3)
                            .map((change, i) => (
                              <div key={i} style={{ marginBottom: '5px' }}>
                                <strong>{change.field}:</strong> {String(change.from)} → {String(change.to)}
                              </div>
                            ))}
                        </div>
                      ) : log.action === 'CREATE' ? (
                        <span>Created</span>
                      ) : log.action === 'DELETE' ? (
                        <span>Deleted</span>
                      ) : log.action === 'LOGIN' ? (
                        <span>Login</span>
                      ) : log.action === 'LOGOUT' ? (
                        <span>Logout</span>
                      ) : (
                        <span>{log.action}</span>
                      )}

                      {(log.ip_address || log.user_agent) && (
                        <div style={{ marginTop: '6px', color: '#94a3b8' }}>
                          {log.ip_address ? <span>IP: {log.ip_address}</span> : null}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '20px', textAlign: 'center', color: '#94a3b8' }}>
        Showing {auditLogs.length} audit logs
      </div>
    </div>
  );
}
