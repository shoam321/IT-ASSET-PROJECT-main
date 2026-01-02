import React, { useState } from 'react';
import { Building, Monitor, Download, ArrowRight, ArrowLeft, Check, Sparkles, Users, Laptop, Server, Smartphone, SkipForward } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';

export default function SetupWizard({ token, onComplete }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [orgData, setOrgData] = useState({
    name: '',
    size: ''
  });

  const [assetData, setAssetData] = useState({
    name: '',
    type: 'Laptop',
    serialNumber: ''
  });

  const totalSteps = 3;
  const sizes = [
    { value: '1-10', label: '1-10', icon: '🏠', desc: 'Small team' },
    { value: '11-50', label: '11-50', icon: '🏢', desc: 'Growing company' },
    { value: '51-200', label: '51-200', icon: '🏭', desc: 'Mid-size' },
    { value: '200+', label: '200+', icon: '🌐', desc: 'Enterprise' }
  ];

  const assetTypes = [
    { value: 'Laptop', icon: Laptop, label: 'Laptop' },
    { value: 'Desktop', icon: Monitor, label: 'Desktop' },
    { value: 'Server', icon: Server, label: 'Server' },
    { value: 'Mobile', icon: Smartphone, label: 'Mobile' }
  ];

  const handleOrgSubmit = async () => {
    if (!orgData.name.trim()) {
      setError('Please enter your company name');
      return;
    }
    if (!orgData.size) {
      setError('Please select your company size');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: orgData.name,
          plan: 'trial',
          settings: { size: orgData.size }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.errors?.[0]?.msg || 'Failed to create organization');
      }

      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssetSubmit = async () => {
    if (!assetData.name.trim()) {
      setError('Please enter a device name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/assets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          asset_tag: `ASSET-${Date.now()}`,
          asset_type: assetData.type,
          manufacturer: 'Unknown',
          model: assetData.name,
          serial_number: assetData.serialNumber || `SN-${Date.now()}`,
          status: 'In Use'
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add asset');
      }

      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      // Mark onboarding as complete
      await fetch(`${API_URL}/auth/complete-onboarding`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (err) {
      console.error('Failed to mark onboarding complete:', err);
    }
    setLoading(false);
    onComplete();
  };

  const handleSkip = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                  s < step
                    ? 'bg-green-500 text-white'
                    : s === step
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {s < step ? <Check className="w-5 h-5" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 sm:w-16 h-1 mx-1 rounded-full transition-all ${
                    s < step ? 'bg-green-500' : 'bg-slate-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 sm:p-8">
          {/* Step 1: Company Info */}
          {step === 1 && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <div className="bg-blue-500/20 p-3 rounded-xl w-fit mx-auto mb-4">
                  <Building className="w-8 h-8 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Let's set up your organization</h2>
                <p className="text-slate-400">Tell us about your company</p>
              </div>

              <div className="space-y-5">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={orgData.name}
                    onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    placeholder="Acme Corporation"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    How many devices do you manage?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {sizes.map((size) => (
                      <button
                        key={size.value}
                        onClick={() => setOrgData({ ...orgData, size: size.value })}
                        className={`p-4 rounded-xl border transition-all text-left ${
                          orgData.size === size.value
                            ? 'bg-blue-500/20 border-blue-500 text-white'
                            : 'bg-slate-700/30 border-slate-600 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <span className="text-2xl mb-1 block">{size.icon}</span>
                        <span className="font-semibold block">{size.label}</span>
                        <span className="text-xs text-slate-400">{size.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={handleOrgSubmit}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {loading ? 'Creating...' : 'Continue'}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Add First Asset */}
          {step === 2 && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <div className="bg-purple-500/20 p-3 rounded-xl w-fit mx-auto mb-4">
                  <Monitor className="w-8 h-8 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Add your first device</h2>
                <p className="text-slate-400">Let's track something right away</p>
              </div>

              <div className="space-y-5">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    Device Type
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {assetTypes.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setAssetData({ ...assetData, type: type.value })}
                        className={`p-3 rounded-xl border transition-all text-center ${
                          assetData.type === type.value
                            ? 'bg-purple-500/20 border-purple-500 text-white'
                            : 'bg-slate-700/30 border-slate-600 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <type.icon className="w-6 h-6 mx-auto mb-1" />
                        <span className="text-xs">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Device Name
                  </label>
                  <input
                    type="text"
                    value={assetData.name}
                    onChange={(e) => setAssetData({ ...assetData, name: e.target.value })}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                    placeholder="MacBook Pro 16"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Serial Number <span className="text-slate-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={assetData.serialNumber}
                    onChange={(e) => setAssetData({ ...assetData, serialNumber: e.target.value })}
                    className="w-full bg-slate-700/50 border border-slate-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                    placeholder="C02G1234XXXX"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-3 text-slate-400 hover:text-white transition"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={handleSkip}
                  className="px-4 py-3 text-slate-400 hover:text-white transition flex items-center gap-1"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip
                </button>
                <button
                  onClick={handleAssetSubmit}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {loading ? 'Adding...' : 'Add Device'}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Download Agent */}
          {step === 3 && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <div className="bg-green-500/20 p-3 rounded-xl w-fit mx-auto mb-4">
                  <Download className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Install the Desktop Agent</h2>
                <p className="text-slate-400">Auto-track device usage and software</p>
              </div>

              <div className="bg-slate-700/30 border border-slate-600 rounded-xl p-6 mb-6">
                <div className="flex items-start gap-4">
                  <div className="bg-slate-600/50 p-3 rounded-lg">
                    <Monitor className="w-8 h-8 text-slate-300" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-2">IT Asset Agent</h3>
                    <ul className="text-slate-400 text-sm space-y-1">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        Runs silently in background
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        2MB download, installs in 30s
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        Auto-detects installed software
                      </li>
                    </ul>
                  </div>
                </div>

                <a
                  href="/tauriagent.exe"
                  download="ITAssetAgent.exe"
                  className="mt-4 w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download for Windows
                </a>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-3 text-slate-400 hover:text-white transition"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {loading ? 'Finishing...' : 'Go to Dashboard'}
                  <Sparkles className="w-5 h-5" />
                </button>
              </div>

              <p className="text-center text-slate-500 text-sm mt-4">
                You can download the agent later from Settings
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
