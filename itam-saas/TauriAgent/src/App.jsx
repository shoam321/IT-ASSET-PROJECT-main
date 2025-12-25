import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [syncStatus, setSyncStatus] = useState("Initializing...");

  // Configuration
  const API_URL = "https://it-asset-project-production.up.railway.app/api";

  // Check for saved token on startup
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUsername = localStorage.getItem('username');
    
    if (savedToken && savedUsername) {
      setAuthToken(savedToken);
      setUsername(savedUsername);
      setIsAuthenticated(true);
      minimizeToTray();
    }
    setIsLoading(false);
  }, []);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Start monitoring after login - send data every 2 minutes
  useEffect(() => {
    if (!isAuthenticated || !authToken) return;

    const sendData = async () => {
      try {
        setSyncStatus("Syncing...");
        const result = await invoke('collect_and_send_usage', { authToken });
        setSyncStatus("Active");
        setLastSync(new Date());
        console.log("Usage data sent:", result);
      } catch (err) {
        setSyncStatus("Error");
        console.error("Failed to send usage data:", err);
      }
    };

    // Send immediately on login
    sendData();

    // Then send every 2 minutes (120000 ms)
    const interval = setInterval(sendData, 120000);

    return () => clearInterval(interval);
  }, [isAuthenticated, authToken]);

  // Auto-minimize to tray
  const minimizeToTray = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.hide();
    } catch (err) {
      console.error("Failed to minimize:", err);
    }
  };

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");

    try {
      const token = await invoke('login_user', { username, password });
      
      // Save token and username
      localStorage.setItem('auth_token', token);
      localStorage.setItem('username', username);
      
      setAuthToken(token);
      setIsAuthenticated(true);
      setLoginError("");
      
      // Auto-minimize to tray after 2 seconds
      setTimeout(() => {
        minimizeToTray();
      }, 2000);
    } catch (err) {
      setLoginError(err);
    }
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('username');
    setAuthToken("");
    setIsAuthenticated(false);
    setUsername("");
    setPassword("");
  };

  // Get friendly greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Format time
  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (isLoading) {
    return (
      <div className="agent-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F5F7FA', color: '#2C3E50' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛡️</div>
          <p style={{ color: '#5B8DEE', fontSize: '1.2rem' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="agent-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F5F7FA', color: '#2C3E50' }}>
        <div style={{ width: '100%', maxWidth: '420px', padding: '2rem', background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🛡️</div>
            <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: '#2C3E50' }}>IT Asset Monitor</h1>
            <p style={{ color: '#7F8C8D', fontSize: '0.95rem' }}>Please sign in to continue</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {loginError && (
              <div style={{ padding: '1rem', background: '#FFE5E5', borderRadius: '12px', color: '#C0392B', fontSize: '0.9rem', borderLeft: '4px solid #E74C3C' }}>
                <strong>⚠️ Login Failed</strong><br/>
                {loginError}
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#2C3E50', fontSize: '0.95rem' }}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                autoFocus
                style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', borderRadius: '10px', border: '2px solid #E0E6ED', background: '#F8FAFB', color: '#2C3E50', outline: 'none', transition: 'all 0.2s' }}
                onFocus={(e) => e.target.style.borderColor = '#5B8DEE'}
                onBlur={(e) => e.target.style.borderColor = '#E0E6ED'}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#2C3E50', fontSize: '0.95rem' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', borderRadius: '10px', border: '2px solid #E0E6ED', background: '#F8FAFB', color: '#2C3E50', outline: 'none', transition: 'all 0.2s' }}
                onFocus={(e) => e.target.style.borderColor = '#5B8DEE'}
                onBlur={(e) => e.target.style.borderColor = '#E0E6ED'}
              />
            </div>

            <button
              type="submit"
              style={{ 
                padding: '1rem', 
                fontSize: '1.05rem', 
                fontWeight: '600', 
                background: 'linear-gradient(135deg, #5B8DEE 0%, #4A7BDE 100%)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '10px', 
                cursor: 'pointer',
                marginTop: '0.5rem',
                transition: 'transform 0.2s'
              }}
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
            >
              Sign In & Start Monitoring
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#95A5A6', marginTop: '0.5rem' }}>
              Default credentials: admin / SecureAdmin2025
            </p>
          </form>
        </div>
      </div>
    );
  }

  // Logged in view - Friendly Dashboard
  return (
    <div className="agent-container" style={{ minHeight: '100vh', background: '#F5F7FA', color: '#2C3E50', padding: '2rem' }}>
      {/* Header */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', marginBottom: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '2.5rem' }}>🛡️</div>
            <div>
              <h1 style={{ fontSize: '1.5rem', margin: 0, color: '#2C3E50' }}>IT Asset Monitor</h1>
              <p style={{ margin: '0.25rem 0 0 0', color: '#7F8C8D', fontSize: '0.9rem' }}>{getGreeting()}, {username}!</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#2C3E50' }}>{formatTime(currentTime)}</div>
            <div style={{ fontSize: '0.85rem', color: '#7F8C8D' }}>{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
          </div>
        </div>
        
        {/* Status Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#D4EDDA', padding: '0.75rem 1.25rem', borderRadius: '10px', border: '2px solid #C3E6CB' }}>
          <span style={{ fontSize: '1.25rem' }}>✓</span>
          <span style={{ color: '#155724', fontWeight: '600', fontSize: '0.95rem' }}>Your device is protected</span>
        </div>
      </div>

      {/* Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Monitoring Status */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📊</div>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#2C3E50' }}>Monitoring Active</h3>
          <p style={{ margin: 0, color: '#7F8C8D', fontSize: '0.9rem' }}>
            {lastSync 
              ? `Last synced: ${Math.floor((new Date() - lastSync) / 1000)}s ago` 
              : 'Initializing...'}
          </p>
          <div style={{ marginTop: '1rem', padding: '0.5rem', background: syncStatus === 'Active' ? '#E8F5E9' : '#FFF3E0', borderRadius: '8px', fontSize: '0.85rem', color: syncStatus === 'Active' ? '#4CAF50' : '#FF9800', fontWeight: '600' }}>
            {syncStatus === 'Syncing...' && '🔄 Syncing data...'}
            {syncStatus === 'Active' && '✓ Sending every 2 minutes'}
            {syncStatus === 'Error' && '⚠️ Connection issue'}
            {syncStatus === 'Initializing...' && '⏳ Starting monitoring...'}
          </div>
        </div>

        {/* Connection Status */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🌐</div>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#2C3E50' }}>Connection</h3>
          <p style={{ margin: 0, color: '#7F8C8D', fontSize: '0.9rem' }}>Railway API endpoint</p>
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: syncStatus === 'Active' ? '#4CAF50' : '#FF9800' }}></div>
            <span style={{ fontSize: '0.85rem', color: syncStatus === 'Active' ? '#4CAF50' : '#FF9800', fontWeight: '600' }}>
              {syncStatus === 'Active' ? 'Connected' : syncStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Info Panel */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', marginBottom: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.2rem', color: '#2C3E50', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>ℹ️</span>
          What We Monitor
        </h3>
        
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ color: '#4CAF50', fontSize: '1.25rem' }}>✓</span>
            <div>
              <div style={{ fontWeight: '600', color: '#2C3E50', fontSize: '0.95rem' }}>Applications used</div>
              <div style={{ color: '#7F8C8D', fontSize: '0.85rem' }}>Track which programs are running</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ color: '#4CAF50', fontSize: '1.25rem' }}>✓</span>
            <div>
              <div style={{ fontWeight: '600', color: '#2C3E50', fontSize: '0.95rem' }}>Device information</div>
              <div style={{ color: '#7F8C8D', fontSize: '0.85rem' }}>System specs and configuration</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ color: '#E74C3C', fontSize: '1.25rem' }}>✗</span>
            <div>
              <div style={{ fontWeight: '600', color: '#2C3E50', fontSize: '0.95rem' }}>Your work or documents</div>
              <div style={{ color: '#7F8C8D', fontSize: '0.85rem' }}>We never monitor your actual content</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ color: '#E74C3C', fontSize: '1.25rem' }}>✗</span>
            <div>
              <div style={{ fontWeight: '600', color: '#2C3E50', fontSize: '0.95rem' }}>Keystrokes or passwords</div>
              <div style={{ color: '#7F8C8D', fontSize: '0.85rem' }}>Your privacy is protected</div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={minimizeToTray}
          style={{ 
            flex: '1',
            minWidth: '200px',
            padding: '1rem 1.5rem', 
            fontSize: '1rem', 
            fontWeight: '600', 
            background: 'linear-gradient(135deg, #5B8DEE 0%, #4A7BDE 100%)', 
            color: 'white', 
            border: 'none', 
            borderRadius: '10px', 
            cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          ↓ Minimize to Tray
        </button>
        
        <button
          onClick={handleLogout}
          style={{ 
            padding: '1rem 1.5rem', 
            fontSize: '1rem', 
            fontWeight: '600', 
            background: 'white', 
            color: '#7F8C8D', 
            border: '2px solid #E0E6ED', 
            borderRadius: '10px', 
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.target.style.borderColor = '#E74C3C';
            e.target.style.color = '#E74C3C';
          }}
          onMouseOut={(e) => {
            e.target.style.borderColor = '#E0E6ED';
            e.target.style.color = '#7F8C8D';
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default App;
