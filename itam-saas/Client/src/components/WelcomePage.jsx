import React, { useState, useEffect } from 'react';
import { Monitor, Shield, BarChart3, Zap, CheckCircle, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://it-asset-project-production.up.railway.app/api';

export default function WelcomePage({ onShowSignIn, onShowSignUp, onGoogleAuth }) {
  const [email, setEmail] = useState('');
  const [isHovering, setIsHovering] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [showExistingUserPrompt, setShowExistingUserPrompt] = useState(false);

  useEffect(() => {
    setAnimateIn(true);
  }, []);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsChecking(true);
    try {
      const response = await fetch(`${API_URL}/auth/check-email?email=${encodeURIComponent(email)}`);
      const data = await response.json();

      if (data.exists) {
        // Email already registered - show prompt to sign in
        setShowExistingUserPrompt(true);
      } else {
        // Email not registered - proceed to signup
        setShowExistingUserPrompt(false);
        onShowSignUp(email);
      }
    } catch (error) {
      console.error('Email check failed:', error);
      // On error, allow signup to proceed (fail open)
      onShowSignUp(email);
    } finally {
      setIsChecking(false);
    }
  };

  const handleGoogleClick = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  const features = [
    { icon: Monitor, title: 'Track Assets', desc: 'Laptops, servers, and devices' },
    { icon: Shield, title: 'License Management', desc: 'Never miss an expiration' },
    { icon: BarChart3, title: 'Usage Analytics', desc: 'Real-time insights' },
    { icon: Zap, title: 'Auto-Discovery', desc: 'Agent-based detection' }
  ];

  const stats = [
    { value: '500+', label: 'Companies' },
    { value: '50k+', label: 'Assets Tracked' },
    { value: '99.9%', label: 'Uptime' },
    { value: '24/7', label: 'Support' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Header */}
      <header className="relative z-10">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 sm:p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
                <Monitor className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <span className="text-lg sm:text-xl font-bold text-white">IT Asset Manager</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={onShowSignIn}
                className="text-slate-300 hover:text-white transition font-medium text-sm sm:text-base px-3 sm:px-4 py-2"
              >
                Sign In
              </button>
              <button
                onClick={() => onShowSignUp('')}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg transition shadow-lg shadow-blue-500/25 text-sm sm:text-base"
              >
                Start Free
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-16 pb-16 sm:pb-24">
        <div className={`text-center max-w-3xl mx-auto transform transition-all duration-1000 ${animateIn ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-6 sm:mb-8">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
            <span className="text-blue-300 text-xs sm:text-sm font-medium">30-Day Free Trial • No Credit Card</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 leading-tight">
            IT Asset Management
            <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              That Just Works
            </span>
          </h1>

          <p className="text-base sm:text-xl text-slate-400 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed px-4">
            Track laptops, software licenses, and devices across your entire organization. 
            Get started in minutes, not days.
          </p>

          {/* Email Capture Form */}
          <form onSubmit={handleEmailSubmit} className="max-w-md mx-auto mb-6 sm:mb-8 px-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your work email"
                  className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-xl px-4 sm:px-5 py-3 sm:py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-500 text-sm sm:text-base"
                />
              </div>
              <button
                type="submit"
                disabled={isChecking}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-xl transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isChecking ? 'Checking...' : 'Start Free Trial'}
                {!isChecking && <ArrowRight className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${isHovering ? 'translate-x-1' : ''}`} />}
              </button>
            </div>
          </form>

          {/* Existing User Prompt */}
          {showExistingUserPrompt && (
            <div className="max-w-md mx-auto mb-6 px-4 animate-fade-in">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-2">Email Already Registered</h3>
                    <p className="text-slate-300 text-sm mb-4">
                      An account with <span className="font-medium text-blue-400">{email}</span> already exists.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={onShowSignIn}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2.5 rounded-lg transition text-sm"
                      >
                        Sign In with Password
                      </button>
                      <button
                        onClick={handleGoogleClick}
                        className="flex-1 bg-white hover:bg-gray-50 text-gray-700 font-medium px-4 py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Sign In with Google
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setShowExistingUserPrompt(false);
                        setEmail('');
                      }}
                      className="mt-3 text-slate-400 hover:text-white text-sm transition w-full text-center"
                    >
                      Try a different email
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="relative max-w-md mx-auto mb-6 sm:mb-8 px-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-slate-950 text-slate-500">or continue with</span>
            </div>
          </div>

          {/* Google Button */}
          <button
            onClick={handleGoogleClick}
            className="inline-flex items-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-xl transition shadow-lg mx-4"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-8 sm:mt-10 text-slate-400 text-xs sm:text-sm px-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" />
              <span>30-day free trial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 max-w-3xl mx-auto mt-12 sm:mt-20 transform transition-all duration-1000 delay-300 ${animateIn ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          {stats.map((stat, i) => (
            <div key={i} className="text-center p-4 sm:p-6 bg-slate-800/30 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-slate-400 text-xs sm:text-sm">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-12 sm:mt-20 transform transition-all duration-1000 delay-500 ${animateIn ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          {features.map((feature, i) => (
            <div 
              key={i} 
              className="group p-5 sm:p-6 bg-slate-800/30 rounded-2xl border border-slate-700/50 hover:border-blue-500/50 transition-all hover:bg-slate-800/50 backdrop-blur-sm"
            >
              <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 p-3 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform">
                <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
              </div>
              <h3 className="text-white font-semibold mb-2 text-sm sm:text-base">{feature.title}</h3>
              <p className="text-slate-400 text-xs sm:text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500 text-xs sm:text-sm">
          <p>© 2026 IT Asset Manager. All rights reserved.</p>
          <div className="mt-2 flex items-center justify-center gap-4">
            <a
              href={`${import.meta.env.VITE_API_URL || 'https://it-asset-project-production.up.railway.app'}/api/legal/privacy-policy`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-blue-400 transition"
            >
              Privacy Policy
            </a>
            <span>•</span>
            <a
              href={`${import.meta.env.VITE_API_URL || 'https://it-asset-project-production.up.railway.app'}/api/legal/terms-of-service`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-blue-400 transition"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
