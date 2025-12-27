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

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      const queryParams = new URLSearchParams();
      if (filters.table) queryParams.append('table', filters.table);
      if (filters.action) queryParams.append('action', filters.action);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      queryParams.append('limit', filters.limit);

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
    fetchAuditLogs();
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'CREATE': return <PlusCircle size={16} className="text-green-500" />;
      case 'UPDATE': return <FileEdit size={16} className="text-blue-500" />;
      case 'DELETE': return <Trash2 size={16} className="text-red-500" />;
      default: return null;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800';
      case 'UPDATE': return 'bg-blue-100 text-blue-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
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

        <button 
          type="submit"
          style={{
            marginTop: '15px',
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
                  <td style={{ padding: '12px' }}>{log.username || 'System'}</td>
                  <td style={{ padding: '12px', fontSize: '12px', color: '#64748b' }}>
                    {log.action === 'UPDATE' && log.old_data && log.new_data ? (
                      <div>
                        {getDiff(log.old_data, log.new_data)?.slice(0, 3).map((change, i) => (
                          <div key={i} style={{ marginBottom: '5px' }}>
                            <strong>{change.field}:</strong> {String(change.from)} → {String(change.to)}
                          </div>
                        ))}
                      </div>
                    ) : log.action === 'CREATE' ? (
                      <span>Record created</span>
                    ) : (
                      <span>Record deleted</span>
                    )}
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
