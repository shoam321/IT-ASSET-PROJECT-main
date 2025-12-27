import React, { createContext, useState, useContext, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');

    if (storedToken) {
      setToken(storedToken);
    }

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        // Ignore malformed user payloads
        setUser(null);
      }
    }
    // If we have a token but no user payload (common after OAuth callback),
    // fetch current user to hydrate state.
    const hydrateUserFromToken = async () => {
      if (!storedToken || storedUser) return;
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`
          }
        });
        if (!response.ok) return;
        const userData = await response.json();
        localStorage.setItem('authUser', JSON.stringify(userData));
        setUser(userData);
      } catch {
        // Ignore failures; user can still use token-authenticated API calls.
      }
    };

    // Don't block initial render on this network call.
    hydrateUserFromToken();
    setLoading(false);
  }, []);

  const login = (authToken, userData) => {
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('authUser', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!token
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
