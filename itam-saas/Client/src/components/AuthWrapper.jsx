import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Login from './Login';
import Register from './Register';
import OnboardingWizard from './OnboardingWizard';
import WelcomePage from './WelcomePage';
import SignUpModal from './SignUpModal';
import WelcomeAnimation from './WelcomeAnimation';
import SetupWizard from './SetupWizard';
import App from '../App';
import { Loader, AlertCircle } from 'lucide-react';

export default function AuthWrapper() {
  const { isAuthenticated, loading, login, user, token } = useAuth();
  const [showRegister, setShowRegister] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [showWelcomeAnimation, setShowWelcomeAnimation] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [onboardingJustCompleted, setOnboardingJustCompleted] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [usePremiumOnboarding, setUsePremiumOnboarding] = useState(true); // Toggle for new UX

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
    // Check if user needs to complete onboarding (but not if just completed)
    if (!onboardingJustCompleted && (showSetupWizard || (user && user.onboarding_completed === false))) {
      return (
        <SetupWizard
          token={token}
          onComplete={() => {
            setShowSetupWizard(false);
            setOnboardingJustCompleted(true);
            // Don't reload - just proceed to OrgGate
          }}
        />
      );
    }
    return <OrgGate />;
  }

  // Premium onboarding: WelcomePage → SignUpModal → WelcomeAnimation → SetupWizard
  if (usePremiumOnboarding) {
    // Show welcome animation after signup
    if (showWelcomeAnimation) {
      return (
        <WelcomeAnimation
          userName={newUserName}
          onComplete={() => {
            setShowWelcomeAnimation(false);
            setShowSetupWizard(true);
          }}
        />
      );
    }

    // Show signup modal
    if (showSignUpModal) {
      return (
        <>
          <WelcomePage onGetStarted={() => {}} onSignIn={() => setShowRegister(false)} />
          <SignUpModal
            isOpen={showSignUpModal}
            onClose={() => setShowSignUpModal(false)}
            onSuccess={(token, userData) => {
              setNewUserName(userData?.firstName || userData?.username || 'there');
              login(token, userData);
              setShowSignUpModal(false);
              setShowWelcomeAnimation(true);
            }}
            onSwitchToLogin={() => {
              setShowSignUpModal(false);
              setShowRegister(false);
            }}
          />
        </>
      );
    }

    // Show login (traditional)
    if (showRegister === 'login') {
      return (
        <Login
          onLoginSuccess={(token, user) => {
            login(token, user);
          }}
          onSwitchToRegister={() => {
            setShowRegister(false);
            setShowSignUpModal(true);
          }}
        />
      );
    }

    // Default: Show WelcomePage
    return (
      <WelcomePage
        onGetStarted={(email) => {
          setShowSignUpModal(true);
        }}
        onSignIn={() => setShowRegister('login')}
      />
    );
  }

  // Legacy flow: If not authenticated, show login or register
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

function OrgGate() {
  const { token } = useAuth();
  const [checking, setChecking] = useState(true);
  const [needsOrg, setNeedsOrg] = useState(false);
  const [error, setError] = useState('');

  const checkStatus = async () => {
    if (!token) return;
    setChecking(true);
    setError('');
    try {
      const resp = await fetch(`${process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api'}/billing`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        // Back-compat: if server returns org missing as 400/409
        const msg = String(data?.error || '').toLowerCase();
        if (msg.includes('not assigned') || msg.includes('organization')) {
          setNeedsOrg(true);
          setChecking(false);
          return;
        }
        throw new Error(data?.error || 'Failed to load billing');
      }
      setNeedsOrg(Boolean(data?.needsOrganization));
    } catch (err) {
      setError(err?.message || 'Failed to verify organization status');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Checking your organization...</p>
        </div>
      </div>
    );
  }

  if (error && !needsOrg) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full space-y-3 text-slate-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <p className="font-semibold">Could not verify organization</p>
              <p className="text-sm text-slate-300">{error}</p>
            </div>
          </div>
          <button
            onClick={checkStatus}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (needsOrg) {
    return (
      <OnboardingWizard
        onComplete={() => {
          // After successful org creation, refresh status so App renders with new token/org.
          checkStatus();
        }}
      />
    );
  }

  // Org exists, proceed to app
  return <App />;
}
