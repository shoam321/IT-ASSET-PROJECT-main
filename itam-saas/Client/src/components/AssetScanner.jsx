import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera, Keyboard, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as dbService from '../services/db';

const AssetScanner = ({ onClose }) => {
  const [assetData, setAssetData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scannerMode, setScannerMode] = useState('camera'); // 'camera' or 'hardware'
  const [scannerActive, setScannerActive] = useState(true);
  const [lastScan, setLastScan] = useState('');
  
  // Use ref to persist buffer across renders
  const bufferRef = useRef('');
  const scannerRef = useRef(null);
  const inputFieldFocusedRef = useRef(false);

  // Fetch asset data from actual API
  const fetchAssetData = async (assetId) => {
    setLoading(true);
    setError(null);
    
    try {
      // Try to find the asset by device_id or asset_tag
      const response = await dbService.fetchAssets();
      const asset = response.find(a => 
        a.device_id === assetId || 
        a.asset_tag === assetId ||
        a.serial_number === assetId
      );

      if (asset) {
        setAssetData(asset);
        setLastScan(assetId);
        setScannerActive(false); // Pause scanner after successful scan
      } else {
        setError(`Asset not found: ${assetId}`);
        setAssetData(null);
      }
    } catch (err) {
      console.error('Error fetching asset:', err);
      setError('Failed to fetch asset data. Please try again.');
      setAssetData(null);
    } finally {
      setLoading(false);
    }
  };

  // Core scanning logic
  const handleScan = useCallback((decodedText) => {
    if (!scannerActive) return; // Don't scan if scanner is paused
    
    console.log(`Scan success: ${decodedText}`);
    fetchAssetData(decodedText);
  }, [scannerActive]);

  // Hardware Scanner (HID) - Barcode Scanner via Keyboard
  useEffect(() => {
    if (scannerMode !== 'hardware') return;

    // Track if user is focused on an input field
    const handleFocusIn = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        inputFieldFocusedRef.current = true;
      }
    };

    const handleFocusOut = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        inputFieldFocusedRef.current = false;
      }
    };

    const handleKeyDown = (e) => {
      // Ignore if user is typing in a form field
      if (inputFieldFocusedRef.current) return;
      
      // Ignore modifier keys
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === 'Enter') {
        if (bufferRef.current.length > 0) {
          handleScan(bufferRef.current);
          bufferRef.current = '';
        }
      } else if (e.key === 'Escape') {
        bufferRef.current = ''; // Clear buffer on escape
      } else if (e.key.length === 1) {
        // Only append single characters
        bufferRef.current += e.key;
        
        // Auto-clear buffer after 500ms of inactivity (in case Enter is missed)
        setTimeout(() => {
          bufferRef.current = '';
        }, 500);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [scannerMode, handleScan]);

  // Camera Scanner
  useEffect(() => {
    if (scannerMode !== 'camera' || !scannerActive) return;

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };

    const scanner = new Html5QrcodeScanner('reader', config, false);
    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => handleScan(decodedText),
      (error) => {
        // Silently handle scan errors (usually just "no QR in frame")
        // Only log actual errors, not "No QR code found"
        if (!error.includes('No QR code found')) {
          console.error('QR scan error:', error);
        }
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => {
          console.error('Error clearing scanner:', err);
        });
      }
    };
  }, [scannerMode, scannerActive, handleScan]);

  // Handle camera permission errors
  useEffect(() => {
    const checkCameraPermission = async () => {
      if (scannerMode === 'camera') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop());
        } catch (err) {
          if (err.name === 'NotAllowedError') {
            setError('Camera permission denied. Please enable camera access or use Hardware Scanner mode.');
          } else if (err.name === 'NotFoundError') {
            setError('No camera found. Please use Hardware Scanner mode.');
          }
        }
      }
    };

    checkCameraPermission();
  }, [scannerMode]);

  const handleScanAnother = () => {
    setAssetData(null);
    setError(null);
    setLastScan('');
    setScannerActive(true);
    bufferRef.current = '';
  };

  const toggleScannerMode = () => {
    setScannerMode(prev => prev === 'camera' ? 'hardware' : 'camera');
    setAssetData(null);
    setError(null);
    setScannerActive(true);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 text-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-blue-400">Asset Scanner</h2>
            <p className="text-sm text-slate-400 mt-1">Scan QR codes to view asset details</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Scanner Mode Toggle */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={toggleScannerMode}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                scannerMode === 'camera'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Camera size={18} />
              Camera Scanner
            </button>
            <button
              onClick={toggleScannerMode}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                scannerMode === 'hardware'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Keyboard size={18} />
              Hardware Scanner
            </button>
          </div>

          {scannerMode === 'hardware' && (
            <p className="text-center text-sm text-slate-400 mt-3">
              Ready to scan. Point your barcode scanner at a QR code.
            </p>
          )}
        </div>

        {/* Camera Viewport */}
        {scannerMode === 'camera' && scannerActive && (
          <div className="p-6">
            <div
              id="reader"
              className="bg-black rounded-lg overflow-hidden border border-slate-700"
            ></div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mx-6 mb-4 p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-start gap-3">
            <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-400">Error</p>
              <p className="text-sm text-red-300 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="p-6 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
          </div>
        )}

        {/* Asset Display Card */}
        {assetData && !loading && (
          <div className="p-6">
            <div className="bg-slate-800 border border-blue-500 border-l-4 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={24} className="text-green-400" />
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">
                    Asset Found
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  assetData.status === 'In Use' ? 'bg-green-900 text-green-300' :
                  assetData.status === 'Available' ? 'bg-blue-900 text-blue-300' :
                  assetData.status === 'Maintenance' ? 'bg-yellow-900 text-yellow-300' :
                  'bg-gray-900 text-gray-300'
                }`}>
                  {assetData.status || 'Unknown'}
                </span>
              </div>

              <h3 className="text-2xl font-semibold text-white mb-1">
                {assetData.manufacturer} {assetData.model}
              </h3>
              <p className="text-slate-400 text-sm mb-4">{assetData.asset_type}</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Asset Tag</p>
                  <p className="font-medium text-white">{assetData.asset_tag || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Serial Number</p>
                  <p className="font-medium text-white">{assetData.serial_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Assigned To</p>
                  <p className="font-medium text-white">{assetData.assigned_user_name || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Device ID</p>
                  <p className="font-medium text-white text-xs">{assetData.device_id || 'N/A'}</p>
                </div>
                {assetData.purchase_date && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Purchase Date</p>
                    <p className="font-medium text-white">
                      {new Date(assetData.purchase_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {assetData.warranty_expiry && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Warranty Expiry</p>
                    <p className="font-medium text-white">
                      {new Date(assetData.warranty_expiry).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {assetData.notes && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Notes</p>
                  <p className="text-sm text-slate-300">{assetData.notes}</p>
                </div>
              )}
            </div>

            {/* Scan Another Button */}
            <button
              onClick={handleScanAnother}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              <RefreshCw size={18} />
              Scan Another Asset
            </button>
          </div>
        )}

        {/* Instructions */}
        {!assetData && !loading && !error && (
          <div className="p-6 text-center text-slate-400">
            <p className="text-sm">
              {scannerMode === 'camera' 
                ? 'Position the QR code within the frame to scan'
                : 'Point your barcode scanner at a QR code and scan'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetScanner;
