import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Package, FileText, AlertTriangle, Download, RefreshCw, ShoppingCart, Shield, ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';

const Dashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [showGrafana, setShowGrafana] = useState(true);

  // Grafana URL configuration
  const GRAFANA_URL = process.env.REACT_APP_GRAFANA_URL || 
    (window.location.hostname === 'localhost' 
      ? 'http://localhost:3000' 
      : 'https://grafana-production-f114.up.railway.app');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Unauthorized. Please login again.');
      }
      const API_URL = process.env.REACT_APP_API_URL
        || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://it-asset-project-production.up.railway.app/api');
      const response = await fetch(`${API_URL}/analytics/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Please login again.');
        }
        if (response.status === 403) {
          throw new Error('Access denied. You do not have permission to view analytics.');
        }
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type = 'all') => {
    try {
      setExporting(true);
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Unauthorized. Please login again.');
      }
      const API_URL = process.env.REACT_APP_API_URL
        || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://it-asset-project-production.up.railway.app/api');
      const response = await fetch(`${API_URL}/analytics/export?type=${type}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `itam-export-${type}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-900">
          <AlertTriangle className="h-5 w-5" />
          <p>{error}</p>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
          >
            Retry
          </button>
          {error?.includes('Unauthorized') && (
            <a href="/login" className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Login</a>
          )}
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const { overview, assetsByCategory, assetsByStatus, recentActivity, upcomingExpirations } = analytics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-600 mt-1">Real-time analytics and insights</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => handleExport('all')}
            disabled={exporting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export All'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Assets"
          value={overview.total_assets}
          icon={Package}
          color="blue"
        />
        <StatCard
          title="Active Users"
          value={overview.total_users}
          icon={Users}
          color="green"
        />
        <StatCard
          title="Licenses"
          value={overview.total_licenses}
          icon={FileText}
          color="purple"
        />
        <StatCard
          title="Consumables"
          value={overview.total_consumables}
          icon={ShoppingCart}
          color="orange"
        />
        <StatCard
          title="Active Contracts"
          value={overview.active_contracts}
          icon={FileText}
          color="indigo"
        />
        <StatCard
          title="Low Stock Items"
          value={overview.low_stock_items}
          icon={AlertTriangle}
          color="red"
          alert={overview.low_stock_items > 0}
        />
        <StatCard
          title="Unresolved Alerts"
          value={overview.unresolved_alerts}
          icon={Shield}
          color="yellow"
          alert={overview.unresolved_alerts > 0}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets by Category */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Assets by Category
          </h3>
          {assetsByCategory.length > 0 ? (
            <div className="space-y-3">
              {assetsByCategory.map((item, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{item.category || 'Uncategorized'}</span>
                    <span className="font-semibold text-gray-900">{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${(item.count / assetsByCategory[0].count) * 100}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No data available</p>
          )}
        </div>

        {/* Assets by Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Assets by Status
          </h3>
          {assetsByStatus.length > 0 ? (
            <div className="space-y-3">
              {assetsByStatus.map((item, idx) => {
                const statusColors = {
                  'In Use': 'bg-green-600',
                  'Available': 'bg-blue-600',
                  'Maintenance': 'bg-yellow-600',
                  'Retired': 'bg-gray-600'
                };
                return (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{item.status || 'Unknown'}</span>
                      <span className="font-semibold text-gray-900">{item.count}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`${statusColors[item.status] || 'bg-gray-600'} h-2 rounded-full transition-all`}
                        style={{
                          width: `${(item.count / assetsByStatus.reduce((sum, s) => sum + parseInt(s.count), 0)) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No data available</p>
          )}
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Recent Activity</h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, idx) => (
                <div key={idx} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      activity.action === 'CREATE' ? 'bg-green-100 text-green-600' :
                      activity.action === 'UPDATE' ? 'bg-blue-100 text-blue-600' :
                      activity.action === 'DELETE' ? 'bg-red-100 text-red-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      <Package className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.action} {activity.entity_type}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        by {activity.username} • {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">No recent activity</div>
            )}
          </div>
        </div>

        {/* Upcoming Expirations */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Upcoming License Expirations</h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {upcomingExpirations.length > 0 ? (
              upcomingExpirations.map((license, idx) => {
                const daysRemaining = parseInt(license.days_remaining);
                const isUrgent = daysRemaining <= 30;
                return (
                  <div key={idx} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        isUrgent ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                      }`}>
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {license.license_name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {license.software_name} • Expires in {daysRemaining} days
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(license.expiration_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-gray-500">No upcoming expirations</div>
            )}
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Exports</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => handleExport('assets')}
            disabled={exporting}
            className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200 disabled:opacity-50"
          >
            Export Assets
          </button>
          <button
            onClick={() => handleExport('licenses')}
            disabled={exporting}
            className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 border border-purple-200 disabled:opacity-50"
          >
            Export Licenses
          </button>
          <button
            onClick={() => handleExport('contracts')}
            disabled={exporting}
            className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 border border-indigo-200 disabled:opacity-50"
          >
            Export Contracts
          </button>
          <button
            onClick={() => handleExport('consumables')}
            disabled={exporting}
            className="px-4 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 border border-orange-200 disabled:opacity-50"
          >
            Export Consumables
          </button>
        </div>
      </div>

      {/* Grafana Monitoring Dashboards */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              Advanced Monitoring
            </h3>
            <button
              onClick={() => setShowGrafana(!showGrafana)}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              {showGrafana ? 'Hide' : 'Show'} Grafana Panels
              {showGrafana ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
        
        {showGrafana && (
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Total Assets Panel */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700">Total Assets</h4>
                </div>
                <iframe
                  src={`${GRAFANA_URL}/d-solo/it-assets/it-asset-dashboard?orgId=1&from=now-7d&to=now&timezone=browser&panelId=1`}
                  width="100%"
                  height="200"
                  frameBorder="0"
                  title="Total Assets"
                  className="w-full"
                />
              </div>

              {/* Assets by Category Panel */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700">Assets by Category</h4>
                </div>
                <iframe
                  src={`${GRAFANA_URL}/d-solo/it-assets/it-asset-dashboard?orgId=1&from=now-7d&to=now&timezone=browser&panelId=2`}
                  width="100%"
                  height="200"
                  frameBorder="0"
                  title="Assets by Category"
                  className="w-full"
                />
              </div>

              {/* Low Stock Items Panel */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700">Low Stock Items</h4>
                </div>
                <iframe
                  src={`${GRAFANA_URL}/d-solo/it-assets/it-asset-dashboard?orgId=1&from=now-7d&to=now&timezone=browser&panelId=3`}
                  width="100%"
                  height="200"
                  frameBorder="0"
                  title="Low Stock Items"
                  className="w-full"
                />
              </div>

              {/* Recent Assets Panel */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700">Recent Assets</h4>
                </div>
                <iframe
                  src={`${GRAFANA_URL}/d-solo/it-assets/it-asset-dashboard?orgId=1&from=now-7d&to=now&timezone=browser&panelId=4`}
                  width="100%"
                  height="200"
                  frameBorder="0"
                  title="Recent Assets"
                  className="w-full"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Data refreshed every 30 seconds
              </p>
              <a
                href={GRAFANA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                Open Full Grafana Dashboard
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ title, value, icon: Icon, color, alert }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    red: 'bg-red-100 text-red-600',
    yellow: 'bg-yellow-100 text-yellow-600'
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${alert ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-200'} p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value || 0}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      {alert && (
        <div className="mt-3 flex items-center gap-1 text-xs text-red-600">
          <AlertTriangle className="h-3 w-3" />
          Requires attention
        </div>
      )}
    </div>
  );
};

export default Dashboard;
