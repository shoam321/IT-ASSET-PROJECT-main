import React, { useMemo, useState } from 'react';
import { Building2, Users, Laptop, Smartphone, MonitorSmartphone, CheckCircle2, ArrowRight, User as UserIcon, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';

// Skeleton wizard that mirrors the state machine defined in types/onboarding.ts
export default function OnboardingWizard({ onComplete }) {
  const { token, login, user } = useAuth();
  const [state, setState] = useState({
    step: 'USER_SELECTION',
    userType: null,
    tempData: {
      teamMembers: [],
    },
    isSubmitting: false,
    error: '',
  });

  const assetPresets = useMemo(
    () => [
      { key: 'laptop', label: 'MacBook', icon: Laptop },
      { key: 'desktop', label: 'Dell XPS', icon: MonitorSmartphone },
      { key: 'mobile', label: 'iPhone', icon: Smartphone },
    ],
    []
  );

  const goTo = (step) => setState((prev) => ({ ...prev, step }));

  const handleUserTypeSelect = (userType) => {
    setState((prev) => ({
      ...prev,
      userType,
      step: userType === 'PRIVATE' ? 'FIRST_ASSET' : 'ORG_DETAILS',
    }));
  };

  const handleOrgSubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const companyName = form.get('companyName')?.toString().trim();
    const primaryLocation = form.get('primaryLocation')?.toString().trim() || 'HQ';
    if (!companyName) return;
    setState((prev) => ({
      ...prev,
      tempData: { ...prev.tempData, companyName, primaryLocation },
      step: 'TEAM_INVITES',
    }));
  };

  const handleTeamSubmit = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const raw = form.get('teamMembers')?.toString() || '';
    const teamMembers = raw
      .split(/\n|,/)
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 10);
    setState((prev) => ({
      ...prev,
      tempData: { ...prev.tempData, teamMembers },
      step: 'FIRST_ASSET',
    }));
  };

  const handleAssetSelect = (presetKey) => {
    setState((prev) => ({
      ...prev,
      tempData: { ...prev.tempData, selectedCategory: presetKey },
      step: 'COMPLETED',
    }));
  };

  const buildPayload = () => {
    const { userType, tempData } = state;
    if (!userType) return null;
    const payload = {
      userType,
    };
    if (userType === 'B2B') {
      payload.organization = {
        name: tempData.companyName || 'New Organization',
        primaryLocation: tempData.primaryLocation || 'HQ',
      };
      payload.initialEmployees = tempData.teamMembers?.map((emailOrName) => ({
        fullName: emailOrName,
        email: emailOrName.includes('@') ? emailOrName : undefined,
      }));
    }
    payload.firstAsset = {
      categorySlug: tempData.selectedCategory || 'laptop',
      modelName: 'Quick Add',
      serialNumber: 'TBD',
      assignedToEmail: payload.initialEmployees?.[0]?.email,
    };
    return payload;
  };

  const handleComplete = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setState((prev) => ({ ...prev, isSubmitting: true, error: '' }));
    try {
      const resp = await fetch(`${API_URL}/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || 'Failed to complete onboarding');
      }

      if (data?.token && user) {
        localStorage.setItem('authToken', data.token);
        login(data.token, user);
      }

      onComplete?.(payload);
      window.location.href = '/inventory';
    } catch (err) {
      setState((prev) => ({ ...prev, error: err?.message || 'Failed to complete onboarding' }));
    } finally {
      setState((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 space-y-8">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-3 rounded-xl">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Onboarding</p>
            <h1 className="text-2xl font-semibold text-white">Set up your workspace</h1>
            <p className="text-slate-400 text-sm">Guided steps adapt for personal vs business users.</p>
          </div>
        </div>

        {state.step === 'USER_SELECTION' && (
          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => handleUserTypeSelect('PRIVATE')}
              className="border border-slate-600 bg-slate-750/50 rounded-xl p-5 text-left hover:border-blue-500 hover:bg-slate-700 transition"
            >
              <div className="flex items-center gap-3 mb-2">
                <UserIcon className="w-5 h-5 text-blue-300" />
                <h3 className="text-lg font-semibold text-white">Personal Use</h3>
              </div>
              <p className="text-sm text-slate-300">Fast path to log your own gear for warranty/insurance.</p>
            </button>

            <button
              onClick={() => handleUserTypeSelect('B2B')}
              className="border border-slate-600 bg-slate-750/50 rounded-xl p-5 text-left hover:border-blue-500 hover:bg-slate-700 transition"
            >
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="w-5 h-5 text-emerald-300" />
                <h3 className="text-lg font-semibold text-white">Business / Team</h3>
              </div>
              <p className="text-sm text-slate-300">Add locations, ghost users, and assign assets with structure.</p>
            </button>
          </div>
        )}

        {state.step === 'ORG_DETAILS' && (
          <form className="space-y-4" onSubmit={handleOrgSubmit}>
            <div>
              <label className="block text-sm text-slate-200 mb-2">Company name</label>
              <input
                name="companyName"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-3"
                placeholder="Acme Corp"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-200 mb-2">Primary location</label>
              <input
                name="primaryLocation"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-3"
                placeholder="New York HQ"
                defaultValue="HQ"
              />
            </div>
            <div className="flex justify-end">
              <button type="submit" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {state.step === 'TEAM_INVITES' && (
          <form className="space-y-4" onSubmit={handleTeamSubmit}>
            <div className="flex items-center gap-2 text-slate-200 text-sm">
              <Users className="w-4 h-4" />
              <span>Paste the first teammates (emails or names).</span>
            </div>
            <textarea
              name="teamMembers"
              rows={4}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-4 py-3"
              placeholder="ceo@company.com, lead.dev@company.com"
              defaultValue={state.tempData.teamMembers.join(', ')}
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>We will create ghost users without sending invites.</span>
              <span>Max 10 entries</span>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => goTo('ORG_DETAILS')} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200">
                Back
              </button>
              <button type="submit" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {state.step === 'FIRST_ASSET' && (
          <div className="space-y-4">
            <div className="text-slate-200 text-sm">Pick a starter asset to create your first record.</div>
            <div className="grid sm:grid-cols-3 gap-3">
              {assetPresets.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => handleAssetSelect(key)}
                  className="border border-slate-600 bg-slate-750/50 rounded-xl p-4 text-left hover:border-blue-500 hover:bg-slate-700 transition flex items-center gap-3"
                >
                  <Icon className="w-5 h-5 text-blue-300" />
                  <div>
                    <div className="text-white font-semibold">{label}</div>
                    <div className="text-xs text-slate-400 capitalize">{key}</div>
                  </div>
                </button>
              ))}
            </div>
            {state.userType === 'B2B' && (
              <p className="text-xs text-slate-400">We will assign it to your first ghost user for a quick win.</p>
            )}
          </div>
        )}

        {state.step === 'COMPLETED' && (
          <div className="space-y-4 text-center text-slate-200">
            <div className="flex justify-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>
            <h3 className="text-xl font-semibold">Ready to finalize</h3>
            <p className="text-sm text-slate-300">We will create your org, ghost users, and first asset in one go.</p>
            {state.error && (
              <div className="flex items-center gap-2 bg-red-900/30 border border-red-700 text-red-200 rounded-lg px-3 py-2 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{state.error}</span>
              </div>
            )}
            <button
              onClick={handleComplete}
              disabled={state.isSubmitting}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-5 py-3 rounded-lg"
            >
              {state.isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Finish and go to inventory'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
