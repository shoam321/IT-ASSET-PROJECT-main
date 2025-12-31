import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Building2, CheckCircle, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Billing = () => {
  const { user, token } = useAuth();
  const effectiveToken = token || localStorage.getItem('authToken');

  const apiUrl = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';
  const clientId = process.env.REACT_APP_PAYPAL_CLIENT_ID || '';
  const regularPlanId = process.env.REACT_APP_PAYPAL_REGULAR_PLAN_ID || '';

  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');

  const [billing, setBilling] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [needsOrganization, setNeedsOrganization] = useState(false);

  const [sdkReady, setSdkReady] = useState(false);
  const paypalRef = useRef(null);
  const paypalButtonsRef = useRef(null);
  const paypalRenderNonceRef = useRef(0);

  const canSubscribe = useMemo(() => {
    if (!effectiveToken) return false;
    if (!clientId || !regularPlanId) return false;
    if (needsOrganization) return false;
    return true;
  }, [effectiveToken, clientId, regularPlanId, needsOrganization]);

  const fetchBilling = useCallback(async () => {
    if (!effectiveToken) return;
    setBillingLoading(true);
    setBillingError('');
    setNeedsOrganization(false);
    try {
      const response = await fetch(`${apiUrl}/billing`, {
        headers: {
          Authorization: `Bearer ${effectiveToken}`
        }
      });
      const data = await response.json();

      if (response.ok && data?.needsOrganization) {
        setNeedsOrganization(true);
        setBilling(null);
        return;
      }

      if (!response.ok) {
        // Backwards-compatible handling if the server responds with 400 for missing organization.
        if (String(data?.error || '').toLowerCase().includes('not assigned to an organization')) {
          setNeedsOrganization(true);
          setBilling(null);
          return;
        }
        setBillingError(data?.error || 'Failed to load billing');
        setBilling(null);
        return;
      }
      setBilling(data?.billing || null);
    } catch {
      setBillingError('Failed to load billing');
      setBilling(null);
    } finally {
      setBillingLoading(false);
    }
  }, [effectiveToken, apiUrl]);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  useEffect(() => {
    if (!effectiveToken) return;
    if (!clientId) {
      setStatus('error');
      setMessage('PayPal client ID is not configured.');
      return;
    }

    // Load PayPal SDK for subscriptions.
    // Note: subscriptions require intent=subscription and vault=true.
    const existing = document.querySelector('script[data-paypal-sdk="subscription"]');
    if (existing) {
      setSdkReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&components=buttons&intent=subscription&vault=true`;
    script.type = 'text/javascript';
    script.async = true;
    script.setAttribute('data-paypal-sdk', 'subscription');
    script.onload = () => setSdkReady(true);
    script.onerror = () => {
      setStatus('error');
      setMessage('Failed to load PayPal SDK. Please refresh.');
    };
    document.body.appendChild(script);

    return () => {
      // Intentionally do NOT remove the PayPal SDK script.
      // Removing it during React route/component changes can break in-flight SDK renders
      // and cause: "Detected container element removed from DOM".
    };
  }, [effectiveToken, clientId]);

  useEffect(() => {
    if (!sdkReady || !window.paypal || !paypalRef.current) return;
    if (!canSubscribe) {
      // Ensure we clean up any previously rendered buttons.
      try {
        paypalButtonsRef.current?.close?.();
      } catch {}
      paypalButtonsRef.current = null;
      if (paypalRef.current) {
        paypalRef.current.innerHTML = '';
      }
      return;
    }

    // If already enterprise or active subscription, don't render subscribe button.
    const tier = String(billing?.billing_tier || '').toLowerCase();
    const subStatus = String(billing?.subscription_status || '').toLowerCase();
    if (tier === 'enterprise' || subStatus === 'active') {
      try {
        paypalButtonsRef.current?.close?.();
      } catch {}
      paypalButtonsRef.current = null;
      paypalRef.current.innerHTML = '';
      return;
    }

    // Close any prior instance before touching the container.
    try {
      paypalButtonsRef.current?.close?.();
    } catch {}
    paypalButtonsRef.current = null;

    // Bump a nonce so async SDK callbacks can detect if they've been superseded.
    paypalRenderNonceRef.current += 1;
    const renderNonce = paypalRenderNonceRef.current;

    const container = paypalRef.current;
    container.innerHTML = '';

    const buttons = window.paypal.Buttons({
      style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'subscribe' },
      createSubscription: (data, actions) => {
        setStatus(null);
        setMessage('');
        return actions.subscription.create({
          plan_id: regularPlanId
        });
      },
      onApprove: async (data) => {
        try {
          const response = await fetch(`${apiUrl}/billing/paypal/subscription/approve`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${effectiveToken}`
            },
            body: JSON.stringify({ subscriptionId: data.subscriptionID })
          });
          const result = await response.json();
          if (!response.ok) {
            setStatus('error');
            setMessage(result?.error || 'Failed to activate subscription');
            return;
          }
          setStatus('success');
          setMessage('Subscription activated for your company.');
          setBilling(result?.billing || null);
        } catch {
          setStatus('error');
          setMessage('Failed to activate subscription');
        }
      },
      onError: () => {
        setStatus('error');
        setMessage('Subscription failed. Please try again.');
      },
      onCancel: () => {
        setStatus('error');
        setMessage('Subscription cancelled.');
      }
    });

    paypalButtonsRef.current = buttons;
    buttons.render(container).catch((error) => {
      // Ignore if a newer render superseded this one.
      if (renderNonce !== paypalRenderNonceRef.current) return;
      console.error('PayPal Buttons render error:', error);
      setStatus('error');
      setMessage('Failed to load subscription button. Please refresh.');
    });

    return () => {
      // Ensure SDK sees a clean teardown (prevents "container removed" exceptions)
      // when navigating away or when dependencies change.
      paypalRenderNonceRef.current += 1;
      try {
        paypalButtonsRef.current?.close?.();
      } catch {}
      paypalButtonsRef.current = null;
    };
  }, [sdkReady, canSubscribe, apiUrl, effectiveToken, regularPlanId, billing]);

  const tier = String(billing?.billing_tier || '').toLowerCase();
  const subStatus = String(billing?.subscription_status || '').toLowerCase();

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-6">
        <CreditCard className="w-6 h-6 text-blue-400" />
        <h2 className="text-2xl font-bold text-white">Billing</h2>
      </div>

      {!effectiveToken && (
        <div className="mb-4 p-4 rounded-lg bg-yellow-900 bg-opacity-30 border border-yellow-700">
          <p className="text-yellow-200 text-sm">You must be logged in to manage billing.</p>
        </div>
      )}

      {status && (
        <div
          className={`mb-4 p-4 rounded-lg flex items-start gap-3 ${
            status === 'success'
              ? 'bg-green-900 bg-opacity-30 border border-green-700'
              : 'bg-red-900 bg-opacity-30 border border-red-700'
          }`}
        >
          {status === 'success' && <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />}
          {status === 'error' && <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
          <p className={`text-sm font-medium ${status === 'success' ? 'text-green-200' : 'text-red-200'}`}>{message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Regular (Monthly)</h3>
          </div>
          <p className="text-slate-300 text-sm mb-4">Self-serve monthly subscription for your company.</p>

          <div className="text-xs text-slate-300 mb-4">
            <div>Company tier: <span className="text-white">{billing?.billing_tier || '—'}</span></div>
            <div>Subscription status: <span className="text-white">{billing?.subscription_status || '—'}</span></div>
            {billing?.subscription_current_period_end && (
              <div>Next billing: <span className="text-white">{new Date(billing.subscription_current_period_end).toLocaleString()}</span></div>
            )}
          </div>

          {billingLoading && <div className="text-xs text-slate-400">Loading billing…</div>}
          {billingError && <div className="text-xs text-red-300">{billingError}</div>}
          {needsOrganization && (
            <div className="text-xs text-yellow-200">
              Your account is not linked to an organization yet. Create or join an organization to manage billing.
            </div>
          )}

          {tier === 'enterprise' && (
            <div className="text-sm text-slate-200">Your company is on Enterprise.</div>
          )}

          {tier !== 'enterprise' && subStatus === 'active' && (
            <div className="text-sm text-green-200">Active subscription ✓</div>
          )}

          {tier !== 'enterprise' && subStatus !== 'active' && (
            <div>
              {!regularPlanId && (
                <div className="text-xs text-red-300 mb-2">Missing `REACT_APP_PAYPAL_REGULAR_PLAN_ID`.</div>
              )}
              {!needsOrganization ? (
                <div ref={paypalRef} className="min-h-[120px]"></div>
              ) : (
                <div className="text-xs text-slate-300">Subscription options will appear after organization setup.</div>
              )}
            </div>
          )}
        </div>

        <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-purple-300" />
            <h3 className="text-lg font-semibold text-white">Enterprise</h3>
          </div>
          <p className="text-slate-300 text-sm mb-4">Enterprise is activated manually for your company.</p>

          <div className="text-xs text-slate-300">
            <div>Includes: custom onboarding, policy support, and higher limits.</div>
            <div className="mt-2">Contact: <span className="text-white">{process.env.REACT_APP_ADMIN_EMAIL || 'support'}</span></div>
          </div>

          {tier === 'enterprise' && (
            <div className="mt-4 text-sm text-green-200">Enterprise active ✓</div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center mt-6">
        Auth: {effectiveToken ? 'token✓' : 'token✗'} / {user ? 'user✓' : 'user✗'}
      </p>
    </div>
  );
};

export default Billing;
