import React, { useState, useEffect } from 'react';
import { Clock, Sparkles, X, AlertTriangle, Zap } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';

export default function TrialBanner({ token, user }) {
  const [trialInfo, setTrialInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    if (user?.trialEndsAt) {
      const endsAt = new Date(user.trialEndsAt);
      const now = new Date();
      const daysLeft = Math.ceil((endsAt - now) / (1000 * 60 * 60 * 24));
      setTrialInfo({
        daysLeft,
        endsAt,
        isExpired: daysLeft <= 0,
        isUrgent: daysLeft <= 7 && daysLeft > 0
      });
    }
  }, [user]);

  if (!trialInfo || dismissed || trialInfo.daysLeft > 14) return null;

  const handleUpgrade = () => {
    window.location.href = '/billing';
  };

  // Expired trial
  if (trialInfo.isExpired) {
    return (
      <>
        <div className="bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">
              Your trial has expired. Upgrade now to continue using all features.
            </span>
          </div>
          <button
            onClick={handleUpgrade}
            className="bg-white text-red-600 px-4 py-1.5 rounded-lg font-semibold hover:bg-red-50 transition flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Upgrade Now
          </button>
        </div>
      </>
    );
  }

  // Urgent (< 7 days)
  if (trialInfo.isUrgent) {
    return (
      <>
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 animate-pulse" />
            <span className="font-medium">
              ⏰ Only <strong>{trialInfo.daysLeft} day{trialInfo.daysLeft !== 1 ? 's' : ''}</strong> left in your trial!
              Upgrade now to keep all your data.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleUpgrade}
              className="bg-white text-orange-600 px-4 py-1.5 rounded-lg font-semibold hover:bg-orange-50 transition flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Upgrade Now
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-white/80 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Upgrade Modal */}
        {showUpgradeModal && (
          <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
        )}
      </>
    );
  }

  // Normal trial banner (8-14 days left)
  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Clock className="w-5 h-5" />
        <span>
          <strong>{trialInfo.daysLeft} days</strong> left in your free trial
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleUpgrade}
          className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-sm font-medium transition"
        >
          View Plans
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/60 hover:text-white p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function UpgradeModal({ onClose }) {
  const plans = [
    {
      name: 'Pro',
      price: 29,
      features: ['Asset & License Tracking', 'Device Usage Monitoring', 'Audit Logs', 'Email Alerts', 'Receipt OCR'],
      popular: false
    },
    {
      name: 'Enterprise',
      price: 99,
      features: ['Everything in Pro', 'Google SSO', 'Grafana Analytics', 'Security Policies', 'Multi-Org Support'],
      popular: true
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Choose Your Plan</h2>
            <p className="text-slate-400">Upgrade to continue tracking your assets</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 grid md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl p-6 border ${
                plan.popular
                  ? 'bg-blue-600/20 border-blue-500'
                  : 'bg-slate-700/50 border-slate-600'
              }`}
            >
              {plan.popular && (
                <span className="bg-blue-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              <h3 className="text-xl font-bold text-white mt-2">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-3xl font-bold text-white">${plan.price}</span>
                <span className="text-slate-400">/month</span>
              </div>
              <ul className="mt-4 space-y-2">
                {plan.features.map((feature, i) => (
                  <li key={i} className="text-slate-300 text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => window.location.href = '/billing'}
                className={`w-full mt-6 py-2.5 rounded-lg font-semibold transition ${
                  plan.popular
                    ? 'bg-blue-500 hover:bg-blue-400 text-white'
                    : 'bg-slate-600 hover:bg-slate-500 text-white'
                }`}
              >
                Select Plan
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
