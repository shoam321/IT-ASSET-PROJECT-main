import React, { useState, useEffect } from 'react';
import './UsageMonitor.css';

const UsageMonitor = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [usageStats, setUsageStats] = useState([]);
  const [appUsageSummary, setAppUsageSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // Fetch all devices
  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated. Please log in again.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/agent/devices`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Authentication failed. Please log in again.');
        }
        throw new Error(`Failed to fetch devices (${response.status})`);
      }
      
      const data = await response.json();
      // Handle both array response and {value: array} response
      const devicesArray = Array.isArray(data) ? data : (data.value || []);
      setDevices(devicesArray);
      setError(null); // Clear any previous errors
      
      // Auto-select first device if none selected
      if (!selectedDevice && data.length > 0) {
        setSelectedDevice(data[0].device_id);
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
      setError(err.message);
      setDevices([]); // Set empty array on error
    }
  };

  // Fetch device usage stats
  const fetchDeviceUsageStats = async (deviceId) => {
    if (!deviceId) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/agent/devices/${deviceId}/usage`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.warn(`Failed to fetch usage stats: ${response.status}`);
        setUsageStats([]);
        return;
      }
      
      const data = await response.json();
      setUsageStats(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching usage stats:', err);
      setUsageStats([]);
    }
  };

  // Fetch app usage summary
  const fetchAppUsageSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/agent/apps/usage`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.warn(`Failed to fetch app usage: ${response.status}`);
        setAppUsageSummary([]);
        return;
      }
      
      const data = await response.json();
      setAppUsageSummary(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching app usage summary:', err);
      setAppUsageSummary([]);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchDevices(),
        fetchAppUsageSummary()
      ]);
      setLoading(false);
    };
    
    loadData();
  }, []);

  // Fetch usage stats when device selected
  useEffect(() => {
    if (selectedDevice) {
      fetchDeviceUsageStats(selectedDevice);
    }
  }, [selectedDevice]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDevices();
      if (selectedDevice) {
        fetchDeviceUsageStats(selectedDevice);
      }
      fetchAppUsageSummary();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [selectedDevice, refreshInterval]);

  // Format duration (seconds to readable format)
  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleString();
  };

  // Get device status indicator
  const getDeviceStatus = (lastSeen) => {
    const now = new Date();
    const last = new Date(lastSeen);
    const diffMinutes = (now - last) / 1000 / 60;
    
    if (diffMinutes < 5) return { text: 'Online', class: 'status-online' };
    if (diffMinutes < 30) return { text: 'Idle', class: 'status-idle' };
    return { text: 'Offline', class: 'status-offline' };
  };

  if (loading) {
    return (
      <div className="usage-monitor">
        <div className="usage-header">
          <h1>📊 Device Usage Monitor</h1>
          <p className="subtitle">Real-time application usage tracking across all devices</p>
        </div>
        <div className="loading" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
          Loading device data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="usage-monitor">
        <div className="usage-header">
          <h1>📊 Device Usage Monitor</h1>
          <p className="subtitle">Real-time application usage tracking across all devices</p>
        </div>
        <div className="error" style={{ textAlign: 'center', padding: '40px', color: '#f87171', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚠️</div>
          <strong>Error:</strong> {error}
          <div style={{ marginTop: '20px', fontSize: '14px', color: '#94a3b8' }}>
            Please make sure the agent is installed and running on your devices.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="usage-monitor">
      <div className="usage-header">
        <h1>📊 Device Usage Monitor</h1>
        <p className="subtitle">Real-time application usage tracking across all devices</p>
      </div>

      <div className="usage-grid">
        {/* Devices List */}
        <div className="devices-panel">
          <div className="panel-header">
            <h2>Monitored Devices</h2>
            <span className="device-count">{devices.length} devices</span>
          </div>
          <div className="devices-list">
            {devices.length === 0 ? (
              <div className="no-devices" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: '48px', marginBottom: '15px' }}>💻</div>
                <strong style={{ display: 'block', marginBottom: '10px', color: '#e2e8f0' }}>No Devices Found</strong>
                <p style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  Install and run the IT Asset Tracker agent on your devices to start monitoring application usage.
                </p>
                <div style={{ marginTop: '20px', padding: '15px', background: '#1e293b', borderRadius: '8px', fontSize: '13px' }}>
                  <strong>📥 To add a device:</strong>
                  <ol style={{ textAlign: 'left', marginTop: '10px', paddingLeft: '20px' }}>
                    <li>Download the agent from the TauriAgent folder</li>
                    <li>Install and run it on your device</li>
                    <li>The device will appear here automatically</li>
                  </ol>
                </div>
              </div>
            ) : (
              devices.map((device) => {
                const status = getDeviceStatus(device.last_seen);
                return (
                  <div
                    key={device.device_id}
                    className={`device-card ${selectedDevice === device.device_id ? 'selected' : ''}`}
                    onClick={() => setSelectedDevice(device.device_id)}
                  >
                    <div className="device-info">
                      <div className="device-name">
                        <span className={`status-dot ${status.class}`}></span>
                        {device.hostname || device.device_id}
                      </div>
                      <div className="device-meta">
                        <span>{device.os_name || 'Unknown OS'}</span>
                        <span className="separator">•</span>
                        <span>{status.text}</span>
                      </div>
                      <div className="device-stats">
                        <span>{device.app_count || 0} apps</span>
                        <span className="separator">•</span>
                        <span>{device.usage_records || 0} records</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Usage Stats for Selected Device */}
        <div className="stats-panel">
          <div className="panel-header">
            <h2>Device Application Usage</h2>
            {selectedDevice && (
              <button onClick={() => fetchDeviceUsageStats(selectedDevice)} className="refresh-btn">
                🔄 Refresh
              </button>
            )}
          </div>
          <div className="stats-content">
            {!selectedDevice ? (
              <div className="no-selection">Select a device to view usage statistics</div>
            ) : usageStats.length === 0 ? (
              <div className="no-data">No usage data available for this device</div>
            ) : (
              <div className="usage-table">
                <table>
                  <thead>
                    <tr>
                      <th>Application</th>
                      <th>Usage Count</th>
                      <th>Total Duration</th>
                      <th>Avg Duration</th>
                      <th>Last Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageStats.map((stat, index) => (
                      <tr key={index}>
                        <td className="app-name">{stat.app_name}</td>
                        <td>{stat.usage_count}</td>
                        <td>{formatDuration(stat.total_duration)}</td>
                        <td>{formatDuration(Math.round(stat.avg_duration))}</td>
                        <td>{formatTimestamp(stat.last_used)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* App Usage Summary */}
        <div className="summary-panel">
          <div className="panel-header">
            <h2>Top Applications (All Devices)</h2>
          </div>
          <div className="summary-content">
            {appUsageSummary.length === 0 ? (
              <div className="no-data">No usage data available</div>
            ) : (
              <div className="app-summary-list">
                {appUsageSummary.slice(0, 10).map((app, index) => (
                  <div key={index} className="app-summary-item">
                    <div className="app-rank">#{index + 1}</div>
                    <div className="app-details">
                      <div className="app-title">{app.app_name}</div>
                      <div className="app-metrics">
                        <span>{app.device_count} devices</span>
                        <span className="separator">•</span>
                        <span>{formatDuration(app.total_duration)}</span>
                      </div>
                    </div>
                    <div className="app-bar">
                      <div 
                        className="app-bar-fill" 
                        style={{ 
                          width: `${(app.total_duration / appUsageSummary[0].total_duration) * 100}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageMonitor;
