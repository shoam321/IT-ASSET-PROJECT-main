import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Building2, CheckCircle, CreditCard, Sparkles, Zap, Shield, ChevronRight } from 'lucide-react';
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
  const [selectedPlan, setSelectedPlan] = useState('regular');

  const [sdkReady, setSdkReady] = useState(false);
  const paypalRef = useRef(null);
  const paypalButtonsRef = useRef(null);
  const paypalRenderNonceRef = useRef(0);

  const plans = {
    regular: {
      name: 'Pro Plan',
      price: 29,
      period: 'month',
      features: [
        'Unlimited Assets',
        'Team Collaboration',
        'Advanced Analytics',
        'Priority Support',
        'API Access'
      ]
    },
    enterprise: {
      name: 'Enterprise',
      price: 99,
      period: 'month',
      features: [
        'Everything in Pro',
        'Custom Onboarding',
        'Dedicated Support',
        'SLA Guarantee',
        'Custom Integrations',
        'Unlimited Users'
      ]
    }
  };

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

    return () => {};
  }, [effectiveToken, clientId]);

  useEffect(() => {
    if (!sdkReady || !window.paypal || !paypalRef.current) return;
    if (!canSubscribe) {
      try {
        paypalButtonsRef.current?.close?.();
      } catch {}
      paypalButtonsRef.current = null;
      if (paypalRef.current) {
        paypalRef.current.innerHTML = '';
      }
      return;
    }

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

    try {
      paypalButtonsRef.current?.close?.();
    } catch {}
    paypalButtonsRef.current = null;

    paypalRenderNonceRef.current += 1;
    const renderNonce = paypalRenderNonceRef.current;

    const container = paypalRef.current;
    container.innerHTML = '';

    const buttons = window.paypal.Buttons({
      style: { layout: 'vertical', color: 'blue', shape: 'pill', label: 'subscribe' },
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
          setMessage('🎉 Subscription activated! Welcome to Pro.');
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
      if (renderNonce !== paypalRenderNonceRef.current) return;
      console.error('PayPal Buttons render error:', error);
      setStatus('error');
      setMessage('Failed to load subscription button. Please refresh.');
    });

    return () => {
      paypalRenderNonceRef.current += 1;
      try {
        paypalButtonsRef.current?.close?.();
      } catch {}
      paypalButtonsRef.current = null;
    };
  }, [sdkReady, canSubscribe, apiUrl, effectiveToken, regularPlanId, billing]);

  const tier = String(billing?.billing_tier || '').toLowerCase();
  const subStatus = String(billing?.subscription_status || '').toLowerCase();
  const currentPlan = plans[selectedPlan];
  const isActive = subStatus === 'active' || tier === 'enterprise';

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-500/10 to-blue-500/10 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl">
              <CreditCard className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Billing & Plans</h1>
              <p className="text-slate-400 text-sm">Manage your subscription</p>
            </div>
          </div>
          
          {isActive && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-sm font-medium">Active Subscription</span>
            </div>
          )}
        </div>

        {/* Status Messages */}
        {status && (
          <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${
            status === 'success'
              ? 'bg-green-500/10 border border-green-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}>
            {status === 'success' && <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />}
            {status === 'error' && <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
            <p className={`text-sm font-medium ${status === 'success' ? 'text-green-300' : 'text-red-300'}`}>{message}</p>
          </div>
        )}

        {!effectiveToken && (
          <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-yellow-300 text-sm">Please log in to manage your billing.</p>
          </div>
        )}

        {/* Main Content - Split Layout */}
        <div className="grid lg:grid-cols-2 gap-8">
          
          {/* Left Side - Plan Card */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden">
            {/* Decorative confetti */}
            <div className="absolute top-4 right-4 w-32 h-32 opacity-50">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle cx="20" cy="20" r="3" fill="#3b82f6" />
                <circle cx="80" cy="30" r="2" fill="#06b6d4" />
                <circle cx="60" cy="70" r="4" fill="#8b5cf6" />
                <circle cx="30" cy="80" r="2" fill="#3b82f6" />
                <rect x="70" y="60" width="6" height="6" fill="#06b6d4" transform="rotate(45 73 63)" />
                <rect x="40" y="30" width="4" height="4" fill="#8b5cf6" transform="rotate(30 42 32)" />
              </svg>
            </div>

            <p className="text-slate-400 text-sm mb-2">Selected Plan</p>
            <h2 className="text-4xl font-bold text-white mb-6">
              ${currentPlan.price}<span className="text-lg text-slate-400">/{currentPlan.period}</span>
            </h2>

            {/* Plan Visual Card */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 mb-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvZz48L3N2Zz4=')] opacity-50" />
              
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-white/80" />
                  <span className="text-white/80 text-sm font-medium">IT Asset Tracker</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">{currentPlan.name}</h3>
                <p className="text-blue-100 text-sm">V3.0</p>
              </div>

              {/* Floating decoration */}
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
            </div>

            {/* Summary */}
            <div className="space-y-3 mb-6">
              <h4 className="text-white font-semibold">Summary</h4>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Items Subtotal:</span>
                <span className="text-white">${currentPlan.price}.00</span>
              </div>
              <div className="text-xs text-slate-500">1 Item</div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Tax:</span>
                <span className="text-white">$0.00</span>
              </div>
              <div className="border-t border-slate-700 pt-3 flex justify-between">
                <span className="text-blue-400 font-medium">Order Total:</span>
                <span className="text-white font-bold">${currentPlan.price}.00</span>
              </div>
            </div>

            {/* Instant Delivery Badge */}
            <div className="flex items-center gap-3 p-4 bg-slate-700/50 rounded-xl">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Zap className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-white font-medium text-sm">Instant Activation</p>
                <p className="text-slate-400 text-xs">Access immediately after payment 🚀</p>
              </div>
            </div>
          </div>

          {/* Right Side - Plan Selection & Payment */}
          <div className="space-y-6">
            {/* Step Indicator */}
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">1</span>
                <span className="text-blue-400 font-medium">Plan</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600" />
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center text-slate-400 text-xs font-bold">2</span>
                <span className="text-slate-400">Payment</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600" />
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center text-slate-400 text-xs font-bold">3</span>
                <span className="text-slate-400">Confirm</span>
              </div>
            </div>

            {/* Plan Selection */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Choose Your Plan</h3>
              
              {/* Plan Cards */}
              <div className="space-y-3">
                {/* Pro Plan */}
                <button
                  onClick={() => setSelectedPlan('regular')}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    selectedPlan === 'regular'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedPlan === 'regular' ? 'border-blue-500 bg-blue-500' : 'border-slate-500'
                      }`}>
                        {selectedPlan === 'regular' && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-white font-semibold">Pro Plan</span>
                    </div>
                    <span className="text-white font-bold">$29<span className="text-slate-400 text-sm">/mo</span></span>
                  </div>
                  <p className="text-slate-400 text-sm ml-8">Perfect for growing teams</p>
                </button>

                {/* Enterprise Plan */}
                <button
                  onClick={() => setSelectedPlan('enterprise')}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    selectedPlan === 'enterprise'
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedPlan === 'enterprise' ? 'border-purple-500 bg-purple-500' : 'border-slate-500'
                      }`}>
                        {selectedPlan === 'enterprise' && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-white font-semibold">Enterprise</span>
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full">Popular</span>
                    </div>
                    <span className="text-white font-bold">$99<span className="text-slate-400 text-sm">/mo</span></span>
                  </div>
                  <p className="text-slate-400 text-sm ml-8">For large organizations</p>
                </button>
              </div>
            </div>

            {/* Features List */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                What's Included
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {currentPlan.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-slate-300">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Current Status */}
            {billing && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <h4 className="text-white font-medium mb-3">Current Status</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Plan:</span>
                    <span className="text-white capitalize">{billing.billing_tier || 'Free'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className={`capitalize ${subStatus === 'active' ? 'text-green-400' : 'text-slate-300'}`}>
                      {billing.subscription_status || 'Inactive'}
                    </span>
                  </div>
                  {billing.subscription_current_period_end && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Next billing:</span>
                      <span className="text-white">{new Date(billing.subscription_current_period_end).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Loading/Error States */}
            {billingLoading && (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Loading billing info...</p>
              </div>
            )}

            {billingError && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-red-300 text-sm">{billingError}</p>
              </div>
            )}

            {needsOrganization && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <p className="text-yellow-300 text-sm">
                  Your account is not linked to an organization. Create or join one to manage billing.
                </p>
              </div>
            )}

            {/* PayPal Button or Status */}
            {tier !== 'enterprise' && subStatus !== 'active' && selectedPlan === 'regular' && (
              <div className="space-y-4">
                {!regularPlanId && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-300 text-xs">PayPal Plan ID not configured.</p>
                  </div>
                )}
                {!needsOrganization ? (
                  <div ref={paypalRef} className="min-h-[50px]" />
                ) : null}
              </div>
            )}

            {selectedPlan === 'enterprise' && tier !== 'enterprise' && (
              <div className="space-y-4">
                <button className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Contact Sales
                </button>
                <p className="text-slate-400 text-xs text-center">
                  Enterprise plans are set up manually. Our team will contact you within 24 hours.
                </p>
              </div>
            )}

            {isActive && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-center">
                <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-green-300 font-medium">You're all set!</p>
                <p className="text-slate-400 text-sm">Your subscription is active.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-slate-500 text-xs">
            Powered by PayPal • Secure payments • Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
};

export default Billing;
