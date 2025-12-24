import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [currentApp, setCurrentApp] = useState("Scanning...");
  const [status, setStatus] = useState("Initializing...");
  const [systemInfo, setSystemInfo] = useState("");
  const [usageHistory, setUsageHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  // Configuration - in production, load from config file
  const config = {
    api_url: "https://it-asset-project-production.up.railway.app/api",
    auth_token: "", // TODO: Set this with your login token from localStorage.getItem('token')
    device_id: "device_" + Math.random().toString(36).substr(2, 9),
    poll_interval: 5,
  };

  useEffect(() => {
    // 1. Listen for usage updates from Rust
    const unlistenUsage = listen("usage-update", (event) => {
      console.log("Usage update:", event.payload);
      setUsageHistory((prev) => [event.payload, ...prev.slice(0, 9)]);
    });

    // 2. Listen for current activity
    const unlistenActivity = listen("current-activity", (event) => {
      setCurrentApp(event.payload);
    });

    // 3. Get agent status on mount
    invoke("get_agent_status").then((s) => {
      setStatus(s);
      setIsConnected(true);
    });

    // 4. Get system info
    invoke("get_system_info").then(setSystemInfo);

    // 5. Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      invoke("send_heartbeat", { config })
        .then(() => setIsConnected(true))
        .catch((err) => {
          console.error("Heartbeat failed:", err);
          setIsConnected(false);
        });
    }, 30000);

    return () => {
      unlistenUsage.then((f) => f());
      unlistenActivity.then((f) => f());
      clearInterval(heartbeatInterval);
    };
  }, []);

  return (
    <div className="agent-container">
      <header className="agent-header">
        <h1>🖥️ IT Asset Agent</h1>
        <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '● Connected' : '○ Disconnected'}
        </div>
      </header>

      <div className="agent-content">
        <section className="status-section">
          <h2>Agent Status</h2>
          <p className="status-text">{status}</p>
          <p className="system-info">{systemInfo}</p>
        </section>

        <section className="activity-section">
          <h2>Current Activity</h2>
          <div className="activity-card">
            <div className="activity-icon">📱</div>
            <div className="activity-details">
              <span className="activity-label">Active Application:</span>
              <h3 className="activity-name">{currentApp}</h3>
            </div>
          </div>
        </section>

        <section className="history-section">
          <h2>Recent Activity</h2>
          <div className="history-list">
            {usageHistory.length === 0 ? (
              <p className="no-history">No activity recorded yet...</p>
            ) : (
              usageHistory.map((item, index) => (
                <div key={index} className="history-item">
                  <span className="history-app">{item.app_name}</span>
                  <span className="history-duration">{item.duration}s</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <footer className="agent-footer">
        <p>Device ID: {config.device_id}</p>
      </footer>
    </div>
  );
}

export default App;
