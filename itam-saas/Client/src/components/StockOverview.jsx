import React, { useState, useEffect } from 'react';
import { Search, Package, TrendingUp, TrendingDown, AlertTriangle, HardDrive, Monitor, Smartphone, Cloud, Network } from 'lucide-react';

const StockOverview = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/assets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch assets');
      const data = await response.json();
      setAssets(data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group assets by type and status
  const getStockByType = () => {
    const grouped = {};
    
    assets.forEach(asset => {
      const type = asset.asset_type || 'other';
      if (!grouped[type]) {
        grouped[type] = { total: 0, available: 0, inUse: 0, maintenance: 0, items: [] };
      }
      
      grouped[type].total++;
      grouped[type].items.push(asset);
      
      if (asset.status === 'Available') grouped[type].available++;
      else if (asset.status === 'In Use') grouped[type].inUse++;
      else if (asset.status === 'Maintenance') grouped[type].maintenance++;
    });
    
    return grouped;
  };

  const stockData = getStockByType();

  // Filter stock categories
  const filteredStock = Object.entries(stockData).filter(([type, data]) => {
    const matchesCategory = categoryFilter === 'all' || type === categoryFilter;
    const matchesSearch = type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      data.items.some(item => 
        item.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.model?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    return matchesCategory && matchesSearch;
  });

  const getTypeIcon = (type) => {
    const icons = {
      hardware: HardDrive,
      software: Cloud,
      network: Network,
      cloud: Cloud,
    };
    return icons[type?.toLowerCase()] || Package;
  };

  const getTypeColor = (type) => {
    const colors = {
      hardware: 'bg-blue-600',
      software: 'bg-purple-600',
      network: 'bg-green-600',
      cloud: 'bg-orange-600',
    };
    return colors[type?.toLowerCase()] || 'bg-slate-600';
  };

  const totalAssets = assets.length;
  const totalAvailable = assets.filter(a => a.status === 'Available').length;
  const totalInUse = assets.filter(a => a.status === 'In Use').length;
  const utilization = totalAssets > 0 ? Math.round((totalInUse / totalAssets) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Stock Overview</h1>
          <p className="text-slate-400">Visual inventory management by asset type</p>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-400 text-sm">Total Assets</p>
            <Package className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-white">{totalAssets}</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-400 text-sm">Available</p>
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-green-400">{totalAvailable}</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-400 text-sm">In Use</p>
            <TrendingDown className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-purple-400">{totalInUse}</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-400 text-sm">Utilization</p>
            <AlertTriangle className={`w-5 h-5 ${utilization > 80 ? 'text-orange-400' : 'text-slate-400'}`} />
          </div>
          <p className={`text-3xl font-bold ${utilization > 80 ? 'text-orange-400' : 'text-white'}`}>{utilization}%</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-slate-700 border border-slate-600 rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search asset types, manufacturers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
          </div>
          
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 bg-slate-600 border border-slate-500 rounded text-white"
          >
            <option value="all">All Categories</option>
            {Object.keys(stockData).map(type => (
              <option key={type} value={type}>{type.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stock Cards Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-slate-400">Loading inventory...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredStock.map(([type, data]) => {
            const Icon = getTypeIcon(type);
            const colorClass = getTypeColor(type);
            const availabilityRate = Math.round((data.available / data.total) * 100);
            
            return (
              <div
                key={type}
                className="group bg-slate-800 border border-slate-700 rounded-2xl p-6 hover:border-blue-500 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                {/* Header with Icon */}
                <div className="flex items-center justify-between mb-4">
                  <div className={`${colorClass} p-3 rounded-xl`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    availabilityRate > 30 ? 'bg-green-900 text-green-300' : 
                    availabilityRate > 10 ? 'bg-yellow-900 text-yellow-300' : 
                    'bg-red-900 text-red-300'
                  }`}>
                    {availabilityRate}% Available
                  </div>
                </div>

                {/* Type Name */}
                <h3 className="text-xl font-bold text-white mb-1 capitalize">{type}</h3>
                <p className="text-slate-400 text-sm mb-4">{data.total} Total Units</p>

                {/* Stock Breakdown */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Available</span>
                    <span className="text-green-400 font-bold">{data.available}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">In Use</span>
                    <span className="text-purple-400 font-bold">{data.inUse}</span>
                  </div>
                  {data.maintenance > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Maintenance</span>
                      <span className="text-orange-400 font-bold">{data.maintenance}</span>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div className="h-full flex">
                    <div
                      className="bg-green-500"
                      style={{ width: `${(data.available / data.total) * 100}%` }}
                    />
                    <div
                      className="bg-purple-500"
                      style={{ width: `${(data.inUse / data.total) * 100}%` }}
                    />
                    <div
                      className="bg-orange-500"
                      style={{ width: `${(data.maintenance / data.total) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Popular Models */}
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-xs text-slate-500 mb-2">Top Models:</p>
                  {data.items.slice(0, 3).map((item, idx) => (
                    <p key={idx} className="text-xs text-slate-400 truncate">
                      • {item.manufacturer} {item.model}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}

          {filteredStock.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No stock found matching your filters</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StockOverview;
