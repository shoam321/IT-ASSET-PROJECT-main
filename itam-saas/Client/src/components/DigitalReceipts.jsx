import React, { useState, useEffect } from 'react';
import { Upload, File, Trash2, Download, X, FileText, Image as ImageIcon, FileSpreadsheet } from 'lucide-react';
import InfoButton from './InfoButton';

const DigitalReceipts = ({ assetId }) => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app';

  useEffect(() => {
    if (assetId) {
      fetchReceipts();
    }
  }, [assetId]);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/assets/${assetId}/receipts`, {
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
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('receipt', selectedFile);
      formData.append('description', description);

      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/assets/${assetId}/receipts`, {
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
      setDescription('');
      setShowUploadForm(false);
      await fetchReceipts();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (receiptId) => {
    if (!window.confirm('Are you sure you want to delete this receipt?')) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/receipts/${receiptId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete receipt');
      await fetchReceipts();
    } catch (err) {
      setError(err.message);
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType?.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
    if (fileType?.includes('pdf')) return <FileText className="w-5 h-5" />;
    if (fileType?.includes('spreadsheet') || fileType?.includes('excel')) return <FileSpreadsheet className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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

  return (
    <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Digital Receipts</h3>
          <InfoButton
            title="Digital Receipts"
            description="Store digital copies of purchase receipts, warranties, and invoices for your assets. Keep all important documents organized and easily accessible for compliance, warranty claims, and audits."
            examples={[
              "Upload purchase receipts for proof of ownership",
              "Store warranty documents for quick reference",
              "Keep invoices for accounting and tax purposes",
              "Attach service records and maintenance logs",
              "Organize contracts and SLAs in one place"
            ]}
          />
        </div>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
        >
          {showUploadForm ? <X className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
          {showUploadForm ? 'Cancel' : 'Upload Receipt'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded-lg">
          <p className="text-red-200 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-xs mt-1 underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {showUploadForm && (
        <div className="mb-4 p-4 bg-slate-600 border border-slate-500 rounded-lg">
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-300 mb-2">
                Select File (Max 10MB - Images, PDF, Word, Excel)
              </label>
              <p className="text-xs text-blue-400 mb-2">
                🤖 AI will automatically extract vendor, date, and cost from receipts
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
                className="w-full px-3 py-2 bg-slate-700 border border-slate-500 rounded text-white placeholder-slate-400 text-sm"
              />
            </div>

            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-500 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition text-sm font-medium"
            >
              {uploading ? 'Uploading...' : 'Upload Receipt'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <p className="text-slate-400">Loading receipts...</p>
        </div>
      ) : receipts.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400">No receipts uploaded yet</p>
          <p className="text-slate-500 text-sm mt-1">Upload documents to keep track of important files</p>
        </div>
      ) : (
        <div className="space-y-2">
          {receipts.map((receipt) => (
            <div
              key={receipt.id}
              className="p-3 bg-slate-600 border border-slate-500 rounded-lg hover:bg-slate-550 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="text-blue-400">
                    {getFileIcon(receipt.file_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{receipt.file_name}</p>
                    {receipt.description && (
                      <p className="text-slate-400 text-xs truncate">{receipt.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <span>{formatFileSize(receipt.file_size)}</span>
                      <span>•</span>
                      <span>{formatDate(receipt.upload_date)}</span>
                      <span>•</span>
                      <span>by {receipt.uploaded_by_name}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <a
                    href={`${API_URL}${receipt.file_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-blue-400 hover:text-blue-300 hover:bg-slate-700 rounded transition"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleDelete(receipt.id)}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded transition"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Show parsed receipt data if available */}
              {receipt.parsing_status === 'success' && (receipt.merchant || receipt.total_amount) && (
                <div className="mt-3 pt-3 border-t border-slate-500">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-green-400">AI Parsed Data</span>
                    <span className="px-2 py-0.5 bg-green-900 text-green-300 text-xs rounded">Verified</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {receipt.merchant && (
                      <div>
                        <span className="text-slate-400">Vendor:</span>
                        <span className="text-white ml-2 font-medium">{receipt.merchant}</span>
                      </div>
                    )}
                    {receipt.total_amount && (
                      <div>
                        <span className="text-slate-400">Total:</span>
                        <span className="text-white ml-2 font-medium">
                          {receipt.currency || '$'}{parseFloat(receipt.total_amount).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {receipt.purchase_date && (
                      <div>
                        <span className="text-slate-400">Date:</span>
                        <span className="text-white ml-2">{new Date(receipt.purchase_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {receipt.tax_amount && (
                      <div>
                        <span className="text-slate-400">Tax:</span>
                        <span className="text-white ml-2">
                          {receipt.currency || '$'}{parseFloat(receipt.tax_amount).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {receipt.parsing_status === 'failed' && (
                <div className="mt-3 pt-3 border-t border-slate-500">
                  <span className="px-2 py-0.5 bg-yellow-900 text-yellow-300 text-xs rounded">
                    ⚠️ Auto-parsing failed - Manual entry required
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DigitalReceipts;
