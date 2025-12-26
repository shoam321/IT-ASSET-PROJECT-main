import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { RefreshCw, Filter } from 'lucide-react';

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
        token: localStorage.getItem('authToken')
      },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('🔌 Connected to alert WebSocket');
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
  }, []);

  const fetchAlerts = async () => {
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
  };

  const fetchStats = async () => {
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
  };

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

  return (
    <>
      {error && (
        <div className="mb-6 p-4 bg-red-900 border border-red-700 rounded-lg">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {loading && (
        <div className="mb-6 p-4 bg-blue-900 border border-blue-700 rounded-lg">
          <p className="text-blue-200">Loading alerts...</p>
        </div>
      )}

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
            <span className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${socket?.connected ? 'bg-green-900 text-green-200 border border-green-700' : 'bg-red-900 text-red-200 border border-red-700'}`}>
              {socket?.connected ? '● Live Updates' : '● Offline'}
            </span>
            <span className="text-xs text-slate-400">
              {socket?.connected ? 'Real-time monitoring active' : 'Auto-refresh disabled - click Refresh'}
            </span>
          </div>
          <button
            onClick={fetchAlerts}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
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
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                    {filter === 'all' ? 'No security alerts' : `No ${filter} alerts`}
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
