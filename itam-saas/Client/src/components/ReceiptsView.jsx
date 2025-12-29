import React, { useState, useEffect } from 'react';
import { FileText, Search, Download, Trash2, Calendar, DollarSign, Building, Filter, X, Upload, Plus } from 'lucide-react';

const ReceiptsView = () => {
  const [receipts, setReceipts] = useState([]);
  const [assets, setAssets] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, success, failed, pending
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  
  const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';

  useEffect(() => {
    fetchAllReceipts();
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/assets`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch assets');
      const data = await response.json();
      
      // Create asset lookup map
      const assetMap = {};
      data.forEach(asset => {
        assetMap[asset.id] = asset;
      });
      setAssets(assetMap);
    } catch (err) {
      console.error('Failed to load assets:', err);
    }
  };

  const fetchAllReceipts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/receipts/all`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch receipts');
      const data = await response.json();
      setReceipts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (receiptId) => {
    if (!window.confirm('Are you sure you want to delete this receipt?')) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/receipts/${receiptId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete receipt');
      await fetchAllReceipts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 
                           'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                           'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      
      if (!allowedTypes.includes(file.type)) {
        setError('Invalid file type. Allowed: Images, PDF, Word, Excel');
        return;
      }

      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedAssetId) {
      setError('Please select a file and an asset');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('receipt', selectedFile);
      formData.append('description', description);

      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/assets/${selectedAssetId}/receipts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      // Reset form and refresh list
      setSelectedFile(null);
      setSelectedAssetId('');
      setDescription('');
      setShowUploadForm(false);
      await fetchAllReceipts();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const filterByDate = (receipt) => {
    if (dateFilter === 'all') return true;
    
    const uploadDate = new Date(receipt.upload_date);
    const now = new Date();
    
    if (dateFilter === 'today') {
      return uploadDate.toDateString() === now.toDateString();
    }
    
    if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return uploadDate >= weekAgo;
    }
    
    if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return uploadDate >= monthAgo;
    }
    
    return true;
  };

  const filteredReceipts = receipts.filter(receipt => {
    // Status filter
    if (statusFilter !== 'all' && receipt.parsing_status !== statusFilter) {
      return false;
    }
    
    // Date filter
    if (!filterByDate(receipt)) {
      return false;
    }
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const asset = assets[receipt.asset_id];
      return (
        receipt.file_name?.toLowerCase().includes(search) ||
        receipt.merchant?.toLowerCase().includes(search) ||
        receipt.description?.toLowerCase().includes(search) ||
        asset?.asset_tag?.toLowerCase().includes(search) ||
        asset?.manufacturer?.toLowerCase().includes(search)
      );
    }
    
    return true;
  });

  const totalAmount = filteredReceipts.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
  const successfulParsing = filteredReceipts.filter(r => r.parsing_status === 'success').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Digital Receipts</h1>
          <p className="text-slate-400">View and manage all purchase receipts across all assets</p>
        </div>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          {showUploadForm ? <X className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
          {showUploadForm ? 'Cancel' : 'Upload Receipt'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900 border border-red-700 rounded-lg">
          <p className="text-red-200">{error}</p>
          <button onClick={() => setError(null)} className="text-sm mt-2 underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Upload Form */}
      {showUploadForm && (
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-4">Upload Receipt</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Select Asset</label>
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
              >
                <option value="">Choose an asset...</option>
                {Object.values(assets).map(asset => (
                  <option key={asset.id} value={asset.id}>
                    {asset.asset_tag} - {asset.manufacturer} {asset.model}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Select File (Max 10MB - Images, PDF, Word, Excel)
              </label>
              <p className="text-xs text-blue-400 mb-2">
                🤖 AI will automatically extract vendor, date, and cost from image receipts
              </p>
              <input
                type="file"
                onChange={handleFileSelect}
                accept="image/jpeg,image/jpg,image/png,application/pdf,.doc,.docx,.xls,.xlsx"
                className="block w-full text-sm text-slate-300
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-600 file:text-white
                  hover:file:bg-blue-700 file:cursor-pointer"
              />
              {selectedFile && (
                <p className="text-xs text-green-400 mt-1">
                  Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">Description (Optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Purchase receipt from Amazon"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
              />
            </div>

            <button
              onClick={handleUpload}
              disabled={!selectedFile || !selectedAssetId || uploading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-500 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition font-medium"
            >
              {uploading ? 'Uploading...' : 'Upload Receipt'}
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">Total Receipts</p>
          <p className="text-3xl font-bold text-white mt-2">{filteredReceipts.length}</p>
        </div>
        
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">Total Value</p>
          <p className="text-3xl font-bold text-green-400 mt-2">${totalAmount.toFixed(2)}</p>
        </div>
        
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">AI Parsed</p>
          <p className="text-3xl font-bold text-blue-400 mt-2">{successfulParsing}</p>
        </div>
        
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <p className="text-slate-400 text-sm">Success Rate</p>
          <p className="text-3xl font-bold text-purple-400 mt-2">
            {receipts.length > 0 ? Math.round((successfulParsing / receipts.length) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-700 border border-slate-600 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search receipts, vendors, assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
            >
              <option value="all">All Status</option>
              <option value="success">✅ Successfully Parsed</option>
              <option value="pending">⏳ Pending</option>
              <option value="failed">❌ Failed</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Receipts List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-slate-400">Loading receipts...</p>
        </div>
      ) : filteredReceipts.length === 0 ? (
        <div className="text-center py-12 bg-slate-700 border border-slate-600 rounded-lg">
          <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No receipts found</p>
          <p className="text-slate-500 text-sm mt-2">Try adjusting your filters or upload receipts from asset details</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReceipts.map((receipt) => {
            const asset = assets[receipt.asset_id] || {};
            
            return (
              <div
                key={receipt.id}
                className="bg-slate-700 border border-slate-600 rounded-lg p-4 hover:border-slate-500 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <FileText className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">{receipt.file_name}</h3>
                        {receipt.description && (
                          <p className="text-slate-400 text-sm mt-1">{receipt.description}</p>
                        )}
                        
                        {/* Asset Info */}
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                          <span className="px-2 py-1 bg-slate-600 rounded">
                            Asset: {asset.asset_tag || 'Unknown'}
                          </span>
                          {asset.manufacturer && (
                            <span className="px-2 py-1 bg-slate-600 rounded">
                              {asset.manufacturer} {asset.model}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Parsed Data */}
                    {receipt.parsing_status === 'success' && (receipt.merchant || receipt.total_amount) && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 p-3 bg-slate-600 rounded-lg border border-green-500/30">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-green-400">✓</span>
                          <span className="text-slate-400">Parsed</span>
                        </div>
                        
                        {receipt.merchant && (
                          <div className="flex items-center gap-2">
                            <Building className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-400">Vendor</p>
                              <p className="text-sm text-white font-medium">{receipt.merchant}</p>
                            </div>
                          </div>
                        )}
                        
                        {receipt.total_amount && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-400">Total</p>
                              <p className="text-sm text-green-400 font-medium">
                                {receipt.currency || '$'}{parseFloat(receipt.total_amount).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {receipt.purchase_date && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-400">Date</p>
                              <p className="text-sm text-white">
                                {new Date(receipt.purchase_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Meta Info */}
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{formatFileSize(receipt.file_size)}</span>
                      <span>•</span>
                      <span>{formatDate(receipt.upload_date)}</span>
                      <span>•</span>
                      <span>by {receipt.uploaded_by_name}</span>
                      {receipt.parsing_status === 'failed' && (
                        <>
                          <span>•</span>
                          <span className="text-yellow-400">⚠️ Parsing failed</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <a
                      href={`${API_URL}${receipt.file_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-blue-400 hover:text-blue-300 hover:bg-slate-600 rounded transition"
                      title="Download"
                    >
                      <Download className="w-5 h-5" />
                    </a>
                    <button
                      onClick={() => handleDelete(receipt.id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-slate-600 rounded transition"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReceiptsView;
