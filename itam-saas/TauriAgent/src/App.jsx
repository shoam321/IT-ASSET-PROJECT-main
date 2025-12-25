import { useState } from "react";
import "./App.css";

function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Configuration
  const API_URL = "https://it-asset-project-production.up.railway.app/api";

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      setIsAuthenticated(true);
      setLoginError("");
      alert(`✅ Login successful! Token: ${data.token.substring(0, 20)}...`);
    } catch (err) {
      setLoginError(err.message);
    }
  };

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="agent-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1a1a1a', color: 'white' }}>
        <div style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🖥️ IT Asset Agent</h1>
            <p style={{ color: '#888' }}>Please login to start monitoring</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {loginError && (
              <div style={{ padding: '0.75rem', background: '#ff4444', borderRadius: '8px', color: 'white', fontSize: '0.9rem' }}>
                {loginError}
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
                autoFocus
                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', borderRadius: '8px', border: '1px solid #333', background: '#2a2a2a', color: 'white' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', borderRadius: '8px', border: '1px solid #333', background: '#2a2a2a', color: 'white' }}
              />
            </div>

            <button
              type="submit"
              style={{ padding: '0.75rem', fontSize: '1rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            >
              Login & Start Monitoring
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#666', marginTop: '1rem' }}>
              Default: admin / SecureAdmin2025
            </p>
          </form>
        </div>
      </div>
    );
  }

  // Logged in view
  return (
    <div className="agent-container" style={{ padding: '2rem', background: '#1a1a1a', color: 'white', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>✅ Agent Running</h1>
      <p style={{ color: '#888' }}>Monitoring active and sending data to server...</p>
      <button
        onClick={() => setIsAuthenticated(false)}
        style={{ marginTop: '2rem', padding: '0.5rem 1rem', background: '#ff4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
      >
        Logout
      </button>
    </div>
  );
}

export default App;
