import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { RefreshCw, Filter, Download } from 'lucide-react';
import InfoButton from './InfoButton';
import { downloadCsv } from '../utils/csvExport';

const AlertHistory = () => {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [socket, setSocket] = useState(null);
  const [wsError, setWsError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true); // Enable auto-refresh by default

  const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app';
  const WS_URL = API_URL.replace('/api', ''); // Remove /api for WebSocket connection

  const fetchAlerts = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/alerts?limit=100`, {
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
  }, [API_URL]);

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/alerts/stats`, {
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
  }, [API_URL]);

  // Fetch alerts on mount and set up auto-refresh
  useEffect(() => {
    fetchAlerts();
    fetchStats();

    // Set up polling fallback (every 30 seconds)
    let pollInterval;
    if (autoRefresh) {
      pollInterval = setInterval(() => {
        fetchAlerts();
        fetchStats();
      }, 30000); // 30 seconds
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [autoRefresh, fetchAlerts, fetchStats]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const newSocket = io(WS_URL, {
      path: '/socket.io/',
      auth: {
        token: localStorage.getItem('authToken')
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('🔌 Connected to alert WebSocket');
      setWsError(null);
    });

    newSocket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err);
      setWsError('Failed to connect to real-time updates. Check your internet connection or try refreshing the page.');
    });

    newSocket.on('security-alert', (alert) => {
      console.log('🚨 Real-time alert received:', alert);
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
  }, [WS_URL, fetchAlerts, fetchStats]);

  const handleStatusChange = async (id, newStatus) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/alerts/${id}`, {
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
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'Low': 'bg-green-900 text-green-200',
      'Medium': 'bg-yellow-900 text-yellow-200',
      'High': 'bg-orange-900 text-orange-200',
      'Critical': 'bg-red-900 text-red-200'
    };
    return colors[severity] || 'bg-slate-600 text-slate-300';
  };

  const getStatusColor = (status) => {
    const colors = {
      'New': 'bg-red-900 text-red-200',
      'Acknowledged': 'bg-yellow-900 text-yellow-200',
      'Resolved': 'bg-green-900 text-green-200',
      'False Positive': 'bg-slate-600 text-slate-300'
    };
    return colors[status] || 'bg-slate-600 text-slate-300';
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    return alert.status === filter;
  });

  const exportAlertsCsv = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadCsv(`security-alerts-${stamp}.csv`, filteredAlerts, [
      { key: 'id', header: 'ID' },
      { key: 'created_at', header: 'Time' },
      { key: 'device_id', header: 'Device ID' },
      { key: 'hostname', header: 'Hostname' },
      { key: 'app_detected', header: 'App Detected' },
      { key: 'severity', header: 'Severity' },
      { key: 'status', header: 'Status' },
      { key: 'rule_name', header: 'Rule Name' },
      { key: 'user_name', header: 'User Name' },
      { key: 'user_email', header: 'User Email' },
    ]);
  };

  return (
    <>
      {error && (
        <div className="mb-6 p-4 bg-red-900 border border-red-700 rounded-lg">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {wsError && (
        <div className="mb-6 p-4 bg-yellow-900 border border-yellow-700 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-yellow-200 font-semibold mb-2">Real-time Updates Unavailable</p>
              <p className="text-yellow-300 text-sm mb-3">{wsError}</p>
              <div className="text-xs text-yellow-400 bg-yellow-950 p-3 rounded border border-yellow-800">
                <strong>💡 Troubleshooting Steps:</strong>
                <ol className="mt-2 ml-4 list-decimal space-y-1">
                  <li>Check your internet connection</li>
                  <li>Refresh the page (F5)</li>
                  <li>Clear browser cache and try again</li>
                  <li>If issue persists, use the Refresh button to manually update alerts</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="mb-6 p-4 bg-blue-900 border border-blue-700 rounded-lg">
          <p className="text-blue-200">Loading alerts...</p>
        </div>
      )}

      <div className="mb-6">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <h1 className="text-3xl font-bold text-white m-0">🔔 Security Alerts</h1>
          <InfoButton
            title="Security Alerts"
            description="Real-time security notifications that automatically trigger when forbidden applications are detected on monitored devices. Stay informed about potential security threats and policy violations."
            examples={[
              "Receive instant alerts when forbidden apps are launched",
              "See which device and user triggered the alert",
              "Filter alerts by status: New, Acknowledged, Resolved, or False Positive",
              "Track alert history to identify repeat offenders or patterns",
              "Get real-time WebSocket updates without needing to refresh"
            ]}
          />
        </div>
        <p className="text-slate-400">Monitor security events and policy violations in real-time</p>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
          >
            <option value="all">All Alerts</option>
            <option value="New">New Only</option>
            <option value="Acknowledged">Acknowledged</option>
            <option value="Resolved">Resolved</option>
            <option value="False Positive">False Positives</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-1">
            <span className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${socket?.connected ? 'bg-green-900 text-green-200 border border-green-700' : autoRefresh ? 'bg-blue-900 text-blue-200 border border-blue-700' : 'bg-red-900 text-red-200 border border-red-700'}`}>
              {socket?.connected ? '● Live (WebSocket)' : autoRefresh ? '● Auto-Refresh (30s)' : '● Manual Only'}
            </span>
            <span className="text-xs text-slate-400">
              {socket?.connected ? 'Real-time updates active' : autoRefresh ? 'Polling every 30 seconds' : 'Click Refresh to update'}
            </span>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${autoRefresh ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-600 hover:bg-slate-500'} text-white`}
          >
            {autoRefresh ? '✓ Auto-Refresh On' : 'Auto-Refresh Off'}
          </button>
          <button
            onClick={exportAlertsCsv}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition border border-slate-600"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => { fetchAlerts(); fetchStats(); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Now
          </button>
        </div>
      </div>

      {stats && (
        <div className="mt-8 mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
            <p className="text-slate-400 text-sm">Total Alerts</p>
            <p className="text-3xl font-bold text-white mt-2">{stats.total_alerts || 0}</p>
          </div>
          <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
            <p className="text-slate-400 text-sm">New</p>
            <p className="text-3xl font-bold text-red-400 mt-2">{stats.new_alerts || 0}</p>
          </div>
          <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
            <p className="text-slate-400 text-sm">Critical</p>
            <p className="text-3xl font-bold text-orange-400 mt-2">{stats.critical_alerts || 0}</p>
          </div>
          <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
            <p className="text-slate-400 text-sm">Last 24h</p>
            <p className="text-3xl font-bold text-blue-400 mt-2">{stats.alerts_24h || 0}</p>
          </div>
        </div>
      )}

      <div className="bg-slate-700 border border-slate-600 rounded-lg overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 border-b border-slate-600">
              <tr>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Time</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Device</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">App Detected</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Severity</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Status</th>
                <th className="px-6 py-3 text-left text-slate-300 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="text-6xl">🛡️</div>
                      <div>
                        <p className="text-slate-300 text-lg font-medium">
                          {filter === 'all' ? 'No security alerts' : `No ${filter} alerts`}
                        </p>
                        <p className="text-slate-500 text-sm mt-2">
                          {filter === 'all' 
                            ? 'Your system is secure. Alerts will appear here when forbidden apps are detected.'
                            : `Change the filter to see alerts with other statuses.`
                          }
                        </p>
                        {!loading && alerts.length === 0 && (
                          <p className="text-slate-400 text-xs mt-3 bg-slate-700 p-3 rounded border border-slate-600">
                            💡 Tip: Make sure the TauriAgent is running on devices to monitor for forbidden apps
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => (
                  <tr 
                    key={alert.id} 
                    className={`border-b border-slate-600 hover:bg-slate-600 transition ${alert.status === 'New' ? 'bg-slate-600/30' : ''}`}
                  >
                    <td className="px-6 py-4 text-slate-300 text-xs">
                      {new Date(alert.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{alert.device_id}</div>
                      {alert.hostname && (
                        <div className="text-xs text-slate-400">{alert.hostname}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-white font-medium font-mono">
                      {alert.app_detected}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(alert.status)}`}>
                        {alert.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {alert.status === 'New' && (
                          <button
                            onClick={() => handleStatusChange(alert.id, 'Acknowledged')}
                            className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs transition"
                          >
                            Acknowledge
                          </button>
                        )}
                        {(alert.status === 'New' || alert.status === 'Acknowledged') && (
                          <>
                            <button
                              onClick={() => handleStatusChange(alert.id, 'Resolved')}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => handleStatusChange(alert.id, 'False Positive')}
                              className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-xs transition"
                            >
                              False
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default AlertHistory;
