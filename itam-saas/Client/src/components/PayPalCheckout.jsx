import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const PayPalCheckout = () => {
  const { user, token } = useAuth();
  const effectiveToken = token || localStorage.getItem('authToken');
  const [amount, setAmount] = useState('10.00');
  const [currency, setCurrency] = useState('USD');
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const paypalRef = useRef(null);

  const apiUrl = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';
  const clientId = process.env.REACT_APP_PAYPAL_CLIENT_ID || '';

  useEffect(() => {
    if (!effectiveToken) return;

    if (!clientId) {
      setStatus('error');
      setMessage('PayPal client ID is not configured.');
      return;
    }

    const existing = document.querySelector('script[data-paypal-sdk]');
    if (existing) {
      const existingCurrency = existing.getAttribute('data-paypal-currency');
      if (existingCurrency === currency) {
        setSdkReady(true);
        return undefined;
      }
      existing.remove();
      setSdkReady(false);
    }

    const script = document.createElement('script');
    // Be explicit about components/locale to avoid PayPal loading extra experiences (e.g. fastlane/card-fields)
    // and to reduce noisy console warnings in some locales.
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}&components=buttons&intent=capture&enable-funding=card`;
    script.type = 'text/javascript';
    script.async = true;
    script.setAttribute('data-paypal-sdk', 'true');
    script.setAttribute('data-paypal-currency', currency);
    script.onload = () => setSdkReady(true);
    script.onerror = () => {
      setStatus('error');
      setMessage('Failed to load PayPal SDK. Please refresh.');
    };
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [effectiveToken, currency, clientId]);

  useEffect(() => {
    if (!sdkReady || !window.paypal || !paypalRef.current || !effectiveToken) return;

    paypalRef.current.innerHTML = '';
    window.paypal.Buttons({
      style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'paypal' },
      createOrder: async () => {
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0 || amountNum > 100000) {
          setStatus('error');
          setMessage('Enter an amount between 0.01 and 100,000.');
          throw new Error('Invalid amount');
        }
        if (!['USD', 'EUR', 'GBP', 'ILS'].includes(currency)) {
          setStatus('error');
          setMessage('Unsupported currency.');
          throw new Error('Invalid currency');
        }

        const response = await fetch(`${apiUrl}/payments/paypal/order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${effectiveToken}`
          },
          body: JSON.stringify({
            amount: amountNum,
            currency,
            description: `Payment of ${currency} ${amountNum.toFixed(2)}`
          })
        });

        const data = await response.json();
        if (!response.ok) {
          setStatus('error');
          setMessage(data.error || 'Failed to create order');
          throw new Error(data.error || 'Failed to create order');
        }

        setStatus(null);
        setMessage('');
        return data.orderId;
      },
      onApprove: async (data) => {
        const response = await fetch(`${apiUrl}/payments/paypal/capture`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${effectiveToken}`
          },
          body: JSON.stringify({ orderId: data.orderID })
        });

        const result = await response.json();
        if (!response.ok) {
          setStatus('error');
          setMessage(result.error || 'Failed to capture payment');
          return;
        }

        setStatus('success');
        setMessage(`Payment successful. Capture ID: ${result.captureId}`);
      },
      onError: () => {
        setStatus('error');
        setMessage('Payment failed. Please try again.');
      },
      onCancel: () => {
        setStatus('error');
        setMessage('Payment cancelled.');
      }
    }).render(paypalRef.current);
  }, [sdkReady, amount, currency, effectiveToken, apiUrl]);

  return (
    <div className="max-w-md mx-auto p-6 bg-slate-700 border border-slate-600 rounded-lg shadow-lg">
      <div className="flex items-center gap-2 mb-6">
        <CreditCard className="w-6 h-6 text-blue-400" />
        <h2 className="text-2xl font-bold text-white">PayPal Checkout</h2>
      </div>

      {!effectiveToken && (
        <div className="mb-4 p-4 rounded-lg bg-yellow-900 bg-opacity-30 border border-yellow-700">
          <p className="text-yellow-200 text-sm">⚠️ You must be logged in to make payments.</p>
        </div>
      )}

      {status && (
        <div className={`mb-4 p-4 rounded-lg flex items-start gap-3 ${
          status === 'success' ? 'bg-green-900 bg-opacity-30 border border-green-700' :
          'bg-red-900 bg-opacity-30 border border-red-700'
        }`}>
          {status === 'success' && <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />}
          {status === 'error' && <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
          <p className={`text-sm font-medium ${status === 'success' ? 'text-green-200' : 'text-red-200'}`}>{message}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-2">Amount</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!effectiveToken}
              className="flex-1 px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              placeholder="10.00"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={!effectiveToken}
              className="px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="ILS">ILS</option>
            </select>
          </div>
        </div>

        <div ref={paypalRef} className="min-h-[150px]"></div>
      </div>

      <p className="text-xs text-slate-400 text-center mt-3">
        Auth: {effectiveToken ? 'token✓' : 'token✗'} / {user ? 'user✓' : 'user✗'}
      </p>

      <p className="text-xs text-slate-400 text-center mt-4">
        💳 PayPal Live. Real charges will be processed.
      </p>
    </div>
  );
};

export default PayPalCheckout;
