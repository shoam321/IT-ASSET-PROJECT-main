import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './UsageMonitor.css';

const AlertHistory = () => {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [socket, setSocket] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app';

  useEffect(() => {
    fetchAlerts();
    fetchStats();

    // Connect to WebSocket for real-time alerts
    const newSocket = io(API_URL, {
      auth: {
        token: localStorage.getItem('token')
      },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('🔌 Connected to alert WebSocket');
    });

    newSocket.on('security-alert', (alert) => {
      console.log('🚨 Real-time alert received:', alert);
      
      // Show toast notification
      toast.error(
        `🚨 Security Alert: ${alert.app_detected} detected on ${alert.device_id}`,
        {
          position: 'top-right',
          autoClose: 10000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        }
      );

      // Play alert sound
      const audio = new Audio('/alert.mp3'); // You can add a sound file
      audio.play().catch(e => console.log('Audio play failed:', e));

      // Refresh alerts list
      fetchAlerts();
      fetchStats();
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Disconnected from alert WebSocket');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/alerts?limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch alerts');

      const data = await response.json();
      setAlerts(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/alerts/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch stats');

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Stats fetch error:', err);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/alerts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update alert');

      fetchAlerts();
      fetchStats();
      toast.success(`✅ Alert marked as ${newStatus}`);
    } catch (err) {
      toast.error(`❌ Error: ${err.message}`);
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

  const getStatusColor = (status) => {
    const colors = {
      'New': '#ef4444',
      'Acknowledged': '#f59e0b',
      'Resolved': '#10b981',
      'False Positive': '#6b7280'
    };
    return colors[status] || '#6b7280';
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    return alert.status === filter;
  });

  if (loading) {
    return (
      <div className="dashboard-container">
        <h2>⏳ Loading alerts...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <h2>❌ Error</h2>
        <p>{error}</p>
        <button onClick={fetchAlerts}>🔄 Retry</button>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <ToastContainer />
      
      <div className="dashboard-header">
        <h2>🚨 Security Alerts</h2>
        <div>
          <span style={{ 
            color: socket?.connected ? '#10b981' : '#ef4444',
            marginRight: '10px',
            fontSize: '12px'
          }}>
            {socket?.connected ? '🟢 Live' : '🔴 Offline'}
          </span>
          <button onClick={fetchAlerts} style={{ padding: '8px 16px', fontSize: '14px' }}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total_alerts || 0}</div>
            <div className="stat-label">Total Alerts</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.new_alerts || 0}</div>
            <div className="stat-label">New</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.critical_alerts || 0}</div>
            <div className="stat-label">Critical</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.alerts_24h || 0}</div>
            <div className="stat-label">Last 24h</div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Filter:</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #ddd',
            fontSize: '14px'
          }}
        >
          <option value="all">All Alerts</option>
          <option value="New">New Only</option>
          <option value="Acknowledged">Acknowledged</option>
          <option value="Resolved">Resolved</option>
          <option value="False Positive">False Positives</option>
        </select>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Device</th>
              <th>App Detected</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAlerts.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                  {filter === 'all' 
                    ? '✅ No security alerts - All clear!' 
                    : `ℹ️ No alerts with status: ${filter}`
                  }
                </td>
              </tr>
            ) : (
              filteredAlerts.map((alert) => (
                <tr key={alert.id} style={{
                  backgroundColor: alert.status === 'New' ? '#fef2f2' : 'transparent'
                }}>
                  <td>{new Date(alert.created_at).toLocaleString()}</td>
                  <td>
                    <strong>{alert.device_id}</strong>
                    {alert.hostname && <div style={{ fontSize: '12px', color: '#666' }}>
                      {alert.hostname}
                    </div>}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {alert.app_detected}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: '#fff',
                        backgroundColor: getSeverityColor(alert.severity)
                      }}
                    >
                      {alert.severity}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: '#fff',
                        backgroundColor: getStatusColor(alert.status)
                      }}
                    >
                      {alert.status}
                    </span>
                  </td>
                  <td>
                    {alert.status === 'New' && (
                      <button
                        onClick={() => handleStatusChange(alert.id, 'Acknowledged')}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#f59e0b',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          marginRight: '5px'
                        }}
                      >
                        ✔️ Acknowledge
                      </button>
                    )}
                    {(alert.status === 'New' || alert.status === 'Acknowledged') && (
                      <>
                        <button
                          onClick={() => handleStatusChange(alert.id, 'Resolved')}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#10b981',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            marginRight: '5px'
                          }}
                        >
                          ✅ Resolve
                        </button>
                        <button
                          onClick={() => handleStatusChange(alert.id, 'False Positive')}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#6b7280',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          ❌ False Positive
                        </button>
                      </>
                    )}
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

export default AlertHistory;
