import React, { useState } from 'react';
import { BarChart3, ExternalLink, RefreshCw, Maximize2, Info } from 'lucide-react';

const Dashboard = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedPanel, setExpandedPanel] = useState(null);

  // Grafana URL configuration
  const GRAFANA_URL = process.env.REACT_APP_GRAFANA_URL || 
    (window.location.hostname === 'localhost' 
      ? 'http://localhost:3000' 
      : 'https://grafana-production-f114.up.railway.app');

  // Time range for panels
  const timeRange = 'from=now-30d&to=now';

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Grafana panels configuration
  const panels = [
    { id: 1, title: 'Total Assets', height: 200, type: 'stat' },
    { id: 2, title: 'Total Users', height: 200, type: 'stat' },
    { id: 3, title: 'Total Licenses', height: 200, type: 'stat' },
    { id: 4, title: 'Low Stock Alert', height: 200, type: 'stat' },
    { id: 5, title: 'Assets by Category', height: 320, type: 'pie' },
    { id: 6, title: 'Assets by Status', height: 320, type: 'bar' },
    { id: 7, title: 'Low Stock Items', height: 400, type: 'table', fullWidth: true },
    { id: 8, title: 'Recent Assets (Last 30 Days)', height: 400, type: 'table', fullWidth: true },
    { id: 9, title: 'License Expirations', height: 400, type: 'table', fullWidth: true },
    { id: 10, title: 'Asset Value Trend', height: 300, type: 'graph', fullWidth: true },
  ];

  return (
    <div className="space-y-6 p-6 bg-slate-900 min-h-screen text-slate-100">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-700 rounded-lg">
              <BarChart3 className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">IT Asset Monitoring Dashboard</h1>
              <p className="text-sm text-slate-300 mt-1">Real-time analytics powered by Grafana</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 border border-slate-600 text-slate-100 rounded-lg hover:bg-slate-600 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh All
            </button>
            <a
              href={GRAFANA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Open Grafana
            </a>
          </div>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {panels.slice(0, 4).map(panel => (
          <GrafanaPanel
            key={`${panel.id}-${refreshKey}`}
            grafanaUrl={GRAFANA_URL}
            panelId={panel.id}
            title={panel.title}
            height={panel.height}
            timeRange={timeRange}
            expanded={expandedPanel === panel.id}
            onToggleExpand={() => setExpandedPanel(expandedPanel === panel.id ? null : panel.id)}
          />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {panels.slice(4, 6).map(panel => (
          <GrafanaPanel
            key={`${panel.id}-${refreshKey}`}
            grafanaUrl={GRAFANA_URL}
            panelId={panel.id}
            title={panel.title}
            height={panel.height}
            timeRange={timeRange}
            expanded={expandedPanel === panel.id}
            onToggleExpand={() => setExpandedPanel(expandedPanel === panel.id ? null : panel.id)}
          />
        ))}
      </div>

      {/* Full Width Tables */}
      <div className="grid grid-cols-1 gap-6">
        {panels.slice(6).map(panel => (
          <GrafanaPanel
            key={`${panel.id}-${refreshKey}`}
            grafanaUrl={GRAFANA_URL}
            panelId={panel.id}
            title={panel.title}
            height={panel.height}
            timeRange={timeRange}
            fullWidth
            expanded={expandedPanel === panel.id}
            onToggleExpand={() => setExpandedPanel(expandedPanel === panel.id ? null : panel.id)}
          />
        ))}
      </div>

      {/* Setup Instructions */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-400 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Grafana Dashboard Setup Instructions</h3>
            <div className="text-sm text-slate-200 space-y-2">
              <p><strong>1. Create Grafana Dashboard:</strong></p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Login to <a href={GRAFANA_URL} target="_blank" rel="noopener noreferrer" className="underline text-blue-300">Grafana</a></li>
                <li>Dashboard UID: <code className="bg-slate-700 px-2 py-1 rounded font-mono">adgfqcl</code> (already created)</li>
                <li>Name: <code className="bg-slate-700 px-2 py-1 rounded">IT Asset Dashboard</code></li>
              </ul>
              
              <p className="mt-3"><strong>2. Add Panels (Sample Queries):</strong></p>
              <ul className="list-disc ml-5 space-y-1">
                <li><strong>Panel 1-4 (Stats):</strong> Total counts for assets, users, licenses, low stock items</li>
                <li><strong>Panel 5 (Pie):</strong> <code className="bg-slate-700 px-1 rounded font-mono text-xs">SELECT category, COUNT(*) FROM assets GROUP BY category</code></li>
                <li><strong>Panel 6 (Bar):</strong> <code className="bg-slate-700 px-1 rounded font-mono text-xs">SELECT status, COUNT(*) FROM assets GROUP BY status</code></li>
                <li><strong>Panel 7 (Table):</strong> <code className="bg-slate-700 px-1 rounded font-mono text-xs">SELECT * FROM consumables WHERE quantity &lt; minimum_stock</code></li>
                <li><strong>Panel 8 (Table):</strong> <code className="bg-slate-700 px-1 rounded font-mono text-xs">SELECT * FROM assets ORDER BY created_at DESC LIMIT 20</code></li>
              </ul>

              <p className="mt-3"><strong>3. Configure Data Source:</strong></p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Type: PostgreSQL</li>
                <li>Host: <code className="bg-slate-700 px-1 rounded font-mono text-xs">caboose.proxy.rlwy.net:31886</code></li>
                <li>Database: <code className="bg-slate-700 px-1 rounded font-mono text-xs">railway</code></li>
                <li>User: <code className="bg-slate-700 px-1 rounded font-mono text-xs">grafana_reader</code></li>
              </ul>

              <p className="mt-3"><strong>4. Enable Public Dashboard:</strong></p>
              <ul className="list-disc ml-5">
                <li>Dashboard Settings → General → Enable "Public Dashboard" for iframe embedding</li>
              </ul>

              <p className="mt-3 text-xs text-slate-300">
                📚 Detailed queries available in <code className="bg-slate-700 px-1 rounded">GRAFANA_SETUP.md</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Grafana Panel Component
const GrafanaPanel = ({ grafanaUrl, panelId, title, height, timeRange, fullWidth, expanded, onToggleExpand }) => {
  const panelHeight = expanded ? height * 1.5 : height;
  const panelUrl = `${grafanaUrl}/d-solo/adgfqcl/it-asset-dashboard?orgId=1&${timeRange}&timezone=browser&panelId=${panelId}&theme=dark`;

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden hover:shadow-xl transition-shadow">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <button
          onClick={onToggleExpand}
          className="text-slate-300 hover:text-white transition-colors p-1 hover:bg-slate-600 rounded"
          title={expanded ? "Collapse panel" : "Expand panel"}
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
      <div className="relative bg-slate-900" style={{ height: panelHeight }}>
        <iframe
          src={panelUrl}
          width="100%"
          height="100%"
          frameBorder="0"
          title={title}
          className="w-full h-full"
          sandbox="allow-scripts allow-same-origin allow-popups"
          loading="lazy"
        />
        {/* Fallback message if iframe fails */}
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800 -z-10">
          <div className="text-center text-slate-400">
            <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Loading panel...</p>
            <p className="text-xs mt-1">Configure Grafana dashboard to view data</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
