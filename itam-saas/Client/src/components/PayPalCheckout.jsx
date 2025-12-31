import React, { useState } from 'react';
import { CreditCard, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const PayPalCheckout = () => {
  const { user, token } = useAuth();
  const [amount, setAmount] = useState('10.00');
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState(null);

  const apiUrl = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';

  // Debug: Log auth state
  console.log('PayPal Auth Debug:', { hasUser: !!user, hasToken: !!token, user });

  const createOrder = async () => {
    console.log('CreateOrder called - Auth check:', { hasUser: !!user, hasToken: !!token });
    
    if (!token || !user) {
      setStatus('error');
      setMessage('Please log in first');
      console.error('Auth failed - token:', !!token, 'user:', !!user);
      return;
    }

    // Input validation
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setStatus('error');
      setMessage('Please enter a valid amount greater than 0');
      return;
    }

    if (amountNum > 100000) {
      setStatus('error');
      setMessage('Amount exceeds maximum limit of 100,000');
      return;
    }

    if (!['USD', 'EUR', 'GBP', 'ILS'].includes(currency)) {
      setStatus('error');
      setMessage('Invalid currency selected');
      return;
    }

    setLoading(true);
    setStatus(null);
    setMessage('');

    try {
      const response = await fetch(`${apiUrl}/payments/paypal/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: amountNum,
          currency,
          description: `Payment of ${currency} ${amountNum.toFixed(2)}`
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create order');
      }

      setOrderId(data.orderId);
      setStatus('created');
      setMessage('Order created! Redirecting to PayPal...');

      // Redirect to PayPal approval
      if (data.approveUrl) {
        setTimeout(() => {
          window.location.href = data.approveUrl;
        }, 1500);
      }
    } catch (error) {
      setStatus('error');
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const captureOrder = async () => {
    if (!orderId || !token || !user) {
      setStatus('error');
      setMessage('Missing order ID or authentication');
      return;
    }

    setLoading(true);
    setStatus(null);
    setMessage('');

    try {
      const response = await fetch(`${apiUrl}/payments/paypal/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ orderId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to capture payment');
      }

      setStatus('success');
      setMessage(`Payment successful! Capture ID: ${data.captureId}`);
      setOrderId(null);
      setAmount('10.00');
    } catch (error) {
      setStatus('error');
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-slate-700 border border-slate-600 rounded-lg shadow-lg">
      <div className="flex items-center gap-2 mb-6">
        <CreditCard className="w-6 h-6 text-blue-400" />
        <h2 className="text-2xl font-bold text-white">PayPal Checkout</h2>
      </div>

      {!user && (
        <div className="mb-4 p-4 rounded-lg bg-yellow-900 bg-opacity-30 border border-yellow-700">
          <p className="text-yellow-200 text-sm">⚠️ You must be logged in to make payments</p>
        </div>
      )}

      {status && (
        <div className={`mb-4 p-4 rounded-lg flex items-start gap-3 ${
          status === 'success' ? 'bg-green-900 bg-opacity-30 border border-green-700' :
          status === 'error' ? 'bg-red-900 bg-opacity-30 border border-red-700' :
          'bg-blue-900 bg-opacity-30 border border-blue-700'
        }`}>
          {status === 'success' && <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />}
          {status === 'error' && <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
          {status === 'created' && <Loader className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5 animate-spin" />}
          <p className={`text-sm font-medium ${
            status === 'success' ? 'text-green-200' :
            status === 'error' ? 'text-red-200' :
            'text-blue-200'
          }`}>
            {message}
          </p>
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
              disabled={loading || !!orderId}
              className="flex-1 px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              placeholder="10.00"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={loading || !!orderId}
              className="px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="ILS">ILS</option>
            </select>
          </div>
        </div>

        {!orderId ? (
          <button
            onClick={createOrder}
            disabled={loading || !user}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-500 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            {loading ? <Loader className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
            {loading ? 'Creating Order...' : !user ? 'Login Required' : 'Pay with PayPal'}
          </button>
        ) : (
          <button
            onClick={captureOrder}
            disabled={loading || !user}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-500 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            {loading ? <Loader className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            {loading ? 'Processing...' : 'Confirm Payment'}
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400 text-center mt-4">
        💳 This uses PayPal Live environment. Real charges will be processed.
      </p>
    </div>
  );
};

export default PayPalCheckout;
