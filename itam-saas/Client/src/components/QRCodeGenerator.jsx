import React, { useRef, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Printer, X } from 'lucide-react';

const QRCodeGenerator = ({ asset, onClose }) => {
  const canvasRef = useRef(null);
  const [qrGenerated, setQrGenerated] = useState(false);

  useEffect(() => {
    if (asset && canvasRef.current) {
      generateQRCode();
    }
  }, [asset]);

  const generateQRCode = async () => {
    try {
      // Generate URL with asset details as query params for hybrid offline/online access
      const baseUrl = window.location.origin;
      const assetTag = asset.asset_tag || asset.device_id || 'unknown';
      
      // Build URL: https://yourdomain.com/assets/LT-12345?type=Laptop&model=Dell+Latitude+5420&sn=ABC123
      const params = new URLSearchParams();
      if (asset.asset_type) params.append('type', asset.asset_type);
      if (asset.manufacturer) params.append('mfg', asset.manufacturer);
      if (asset.model) params.append('model', asset.model);
      if (asset.serial_number) params.append('sn', asset.serial_number);
      if (asset.assigned_user_name) params.append('user', asset.assigned_user_name);
      
      const qrData = `${baseUrl}/assets/${assetTag}?${params.toString()}`;
      
      await QRCode.toCanvas(canvasRef.current, qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      
      setQrGenerated(true);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleDownload = () => {
    if (canvasRef.current) {
      const url = canvasRef.current.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `QR-${asset.asset_tag || asset.device_id}.png`;
      link.href = url;
      link.click();
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const baseUrl = window.location.origin;
    const assetTag = asset.asset_tag || asset.device_id || 'unknown';
    
    // Build URL with asset details
    const params = new URLSearchParams();
    if (asset.asset_type) params.append('type', asset.asset_type);
    if (asset.manufacturer) params.append('mfg', asset.manufacturer);
    if (asset.model) params.append('model', asset.model);
    if (asset.serial_number) params.append('sn', asset.serial_number);
    if (asset.assigned_user_name) params.append('user', asset.assigned_user_name);
    
    const qrData = `${baseUrl}/assets/${assetTag}?${params.toString()}`;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Asset QR Code - ${asset.asset_tag}</title>
          <style>
            @media print {
              body { margin: 0; }
              @page { size: 4in 2in; margin: 0; }
            }
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 20px;
              background: white;
            }
            .label {
              border: 2px solid #000;
              padding: 15px;
              text-align: center;
              max-width: 4in;
            }
            .title {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .info {
              font-size: 11px;
              margin: 5px 0;
            }
            .url {
              font-size: 9px;
              color: #666;
              margin-top: 8px;
              word-break: break-all;
            }
            canvas {
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="title">${asset.manufacturer || ''} ${asset.model || ''}</div>
            <canvas id="qr"></canvas>
            <div class="info"><strong>Asset Tag:</strong> ${asset.asset_tag || 'N/A'}</div>
            <div class="info"><strong>Type:</strong> ${asset.asset_type || 'N/A'}</div>
            <div class="info"><strong>Serial:</strong> ${asset.serial_number || 'N/A'}</div>
            ${asset.assigned_user_name ? `<div class="info"><strong>User:</strong> ${asset.assigned_user_name}</div>` : ''}
            <div class="url">Scan to view: ${baseUrl}/assets/${assetTag}</div>
          </div>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <script>
            QRCode.toCanvas(document.getElementById('qr'), '${qrData}', {
              width: 200,
              margin: 2
            }, function(error) {
              if (error) console.error(error);
              setTimeout(() => window.print(), 500);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Generate QR Code</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col items-center">
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <canvas ref={canvasRef} className="max-w-full"></canvas>
          </div>

          <div className="text-center mb-6">
            <p className="text-sm font-medium text-gray-700">{asset.manufacturer} {asset.model}</p>
            <p className="text-xs text-gray-500 mt-1">Asset Tag: {asset.asset_tag || 'N/A'}</p>
            <p className="text-xs text-gray-500">Type: {asset.asset_type || 'N/A'}</p>
            <p className="text-xs text-gray-500">Serial: {asset.serial_number || 'N/A'}</p>
            {asset.assigned_user_name && (
              <p className="text-xs text-gray-500">User: {asset.assigned_user_name}</p>
            )}
            <p className="text-xs text-blue-600 mt-2">Scan to view asset details</p>
          </div>

          <div className="flex gap-3 w-full">
            <button
              onClick={handleDownload}
              disabled={!qrGenerated}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors font-medium"
            >
              <Download size={18} />
              Download
            </button>
            <button
              onClick={handlePrint}
              disabled={!qrGenerated}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg transition-colors font-medium"
            >
              <Printer size={18} />
              Print Label
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeGenerator;
