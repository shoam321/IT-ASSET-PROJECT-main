import React, { useState } from 'react';
import { LogIn, User, Lock, AlertCircle, Loader } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';

export default function Login({ onLoginSuccess, onSwitchToRegister }) {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Call parent callback with token and user data
      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-6 md:mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="bg-blue-600 p-2 md:p-3 rounded-xl">
              <LogIn className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Welcome Back!</h1>
          <p className="text-sm md:text-base text-slate-400">Sign in to access IT Asset Tracker</p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800 rounded-xl shadow-2xl p-6 md:p-8 border border-slate-700">
          <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-900 bg-opacity-20 border border-red-700 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2 animate-slide-in">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Username Field */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Enter your username"
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Enter your password"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              Don't have an account?{' '}
              <button
                onClick={onSwitchToRegister}
                className="text-blue-400 hover:text-blue-300 font-medium transition"
              >
                Create one here
              </button>
            </p>
          </div>
        </div>

        {/* Demo Credentials */}
        <div className="mt-6 bg-slate-800 bg-opacity-50 border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-xs text-center">
            <strong className="text-slate-300">Demo Credentials:</strong> admin / SecureAdmin2025
          </p>
        </div>
      </div>
    </div>
  );
}
