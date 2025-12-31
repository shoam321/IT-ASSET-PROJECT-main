import React, { useState } from 'react';
import { Building2, Globe2, Loader2, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';

export default function Onboarding({ onComplete }) {
  const { token, login, user } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!orgName.trim()) {
      setError('Organization name is required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/organizations/bootstrap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: orgName.trim(),
          domain: domain.trim() || null
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create organization');
      }

      const newToken = data?.token;
      if (newToken) {
        localStorage.setItem('authToken', newToken);
      }

      let userData = null;
      if (newToken) {
        try {
          const meResp = await fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${newToken}` }
          });
          if (meResp.ok) {
            userData = await meResp.json();
          }
        } catch {
          // Non-fatal; we still proceed with existing user data if available.
        }
      }

      const resolvedUser = userData || user || null;
      if (newToken && resolvedUser) {
        login(newToken, resolvedUser);
      }

      setSuccess('Organization created. You are now ready to continue.');
      onComplete?.();
    } catch (err) {
      setError(err?.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-3 rounded-xl">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Step 1 of 1</p>
            <h1 className="text-2xl font-semibold text-white">Create your organization</h1>
            <p className="text-slate-400 text-sm">This links your team, billing, and assets under one tenant.</p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 bg-red-900/30 border border-red-700 text-red-200 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Could not create organization</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 bg-emerald-900/30 border border-emerald-700 text-emerald-200 rounded-lg p-4">
            <CheckCircle2 className="w-5 h-5 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Success</p>
              <p className="text-sm">{success}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">Organization name</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Acme Corp"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">Company domain (optional)</label>
            <div className="relative">
              <Globe2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="example.com"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">Optional: helps us validate email domains for invites later.</p>
          </div>

          <div className="flex items-center justify-between bg-slate-700/60 border border-slate-600 rounded-lg px-4 py-3 text-slate-200 text-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Single tenant per org: billing, assets, and users stay isolated.</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating organization...
              </>
            ) : (
              'Create organization'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
