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

  const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';

  useEffect(() => {
    if (assetId) {
      fetchReceipts();
    }
  }, [assetId]);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/assets/${assetId}/receipts`, {
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
      const response = await fetch(`${API_URL}/assets/${assetId}/receipts`, {
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
      const response = await fetch(`${API_URL}/receipts/${receiptId}`, {
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
      <div className="flex items-center gap-2 mb-4">
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

      {error && (
        <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded-lg">
          <p className="text-red-200 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-xs mt-1 underline hover:no-underline">
            Dismiss
          </button>
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
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold text-green-400">🤖 AI Extracted Data (Tesseract OCR)</span>
                    <span className="px-2 py-0.5 bg-green-900 text-green-300 text-xs rounded font-medium">✓ Verified</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {receipt.merchant && (
                      <div className="bg-slate-800 p-2 rounded">
                        <div className="text-slate-400 text-xs mb-1">Merchant</div>
                        <div className="text-white font-medium">{receipt.merchant}</div>
                      </div>
                    )}
                    {receipt.total_amount && (
                      <div className="bg-slate-800 p-2 rounded">
                        <div className="text-slate-400 text-xs mb-1">Total Amount</div>
                        <div className="text-green-400 font-bold text-base">
                          {receipt.currency || '$'}{parseFloat(receipt.total_amount).toFixed(2)}
                        </div>
                      </div>
                    )}
                    {receipt.purchase_date && (
                      <div className="bg-slate-800 p-2 rounded">
                        <div className="text-slate-400 text-xs mb-1">Purchase Date</div>
                        <div className="text-white">{new Date(receipt.purchase_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      </div>
                    )}
                    {receipt.tax_amount && (
                      <div className="bg-slate-800 p-2 rounded">
                        <div className="text-slate-400 text-xs mb-1">Tax Amount</div>
                        <div className="text-white">
                          {receipt.currency || '$'}{parseFloat(receipt.tax_amount).toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                  {receipt.parsed_data?.extracted_text && (
                    <details className="mt-3">
                      <summary className="text-xs text-blue-400 cursor-pointer hover:text-blue-300">
                        View Full OCR Text
                      </summary>
                      <div className="mt-2 p-2 bg-slate-800 rounded text-xs text-slate-300 max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">
                        {receipt.parsed_data.extracted_text}
                      </div>
                    </details>
                  )}
                </div>
              )}
              
              {receipt.parsing_status === 'failed' && (
                <div className="mt-3 pt-3 border-t border-slate-500">
                  <span className="px-2 py-1 bg-yellow-900 text-yellow-300 text-xs rounded">
                    ⚠️ OCR parsing failed - Please verify file quality
                  </span>
                </div>
              )}
              
              {receipt.parsing_status === 'unsupported_type' && (
                <div className="mt-3 pt-3 border-t border-slate-500">
                  <span className="px-2 py-1 bg-slate-600 text-slate-300 text-xs rounded">
                    📄 Document stored (OCR not available for this file type)
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
