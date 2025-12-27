import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Login from './Login';
import Register from './Register';
import App from '../App';
import { Loader } from 'lucide-react';

export default function AuthWrapper() {
  const { isAuthenticated, loading, login } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');

    if (token) {
      // Store token and redirect to main app
      localStorage.setItem('authToken', token);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Trigger login in AuthContext
      window.location.reload();
    } else if (error) {
      console.error('OAuth error:', error);
      alert('Google sign-in failed. Please try again or use email/password login.');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Show loading screen while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If authenticated, show main app
  if (isAuthenticated) {
    return <App />;
  }

  // If not authenticated, show login or register
  return showRegister ? (
    <Register
      onRegisterSuccess={(token, user) => {
        login(token, user);
      }}
      onSwitchToLogin={() => setShowRegister(false)}
    />
  ) : (
    <Login
      onLoginSuccess={(token, user) => {
        login(token, user);
      }}
      onSwitchToRegister={() => setShowRegister(true)}
    />
  );
}
