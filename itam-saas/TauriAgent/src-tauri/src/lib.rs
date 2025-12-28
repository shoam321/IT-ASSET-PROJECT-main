use tauri::{AppHandle, Emitter, Manager, menu::{MenuBuilder, MenuItemBuilder}, tray::{TrayIconBuilder, TrayIconEvent}};
use tauri_plugin_single_instance::init as single_instance_init;
use std::{thread, time::{Duration, SystemTime}};
use std::net::{TcpListener, TcpStream};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use sysinfo::System;
use serde::{Deserialize, Serialize};
use lazy_static::lazy_static;

mod forbidden;
use forbidden::{ForbiddenApp, ViolationReport, sync_forbidden_list, scan_processes, report_violation};

// ============================================================================
// GLOBAL STATE: Authentication Token for Forbidden App Monitoring
// ============================================================================
// This global state allows sharing the authentication token between:
// 1. The React frontend (via set_monitoring_token command)
// 2. The background monitoring thread (start_forbidden_app_monitoring)
//
// Why Arc<Mutex<String>>?
// - Arc: Allows multiple threads to own the same data (cheap cloning)
// - Mutex: Ensures thread-safe read/write access (prevents data races)
// - lazy_static: Initializes once, lives for entire program lifetime
//
// Flow: React login -> invoke('set_monitoring_token') -> AUTH_TOKEN updated ->
//       Background thread reads token -> Makes authenticated API calls
// ============================================================================
lazy_static! {
    static ref AUTH_TOKEN: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UsageData {
    app_name: String,
    window_title: String,
    duration: u64,
    timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AgentConfig {
    api_url: String,
    auth_token: String,
    device_id: String,
    poll_interval: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct LoginResponse {
    token: String,
}

fn parse_query_param(query: &str, key: &str) -> Option<String> {
    for pair in query.split('&') {
        let mut it = pair.splitn(2, '=');
        let k = it.next().unwrap_or("");
        let v = it.next().unwrap_or("");
        if k == key {
            // Basic URL decode for %XX and +
            let v = v.replace('+', " ");
            let bytes = v.as_bytes();
            let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
            let mut i = 0;
            while i < bytes.len() {
                if bytes[i] == b'%' && i + 2 < bytes.len() {
                    if let (Some(h), Some(l)) = (hex_val(bytes[i + 1]), hex_val(bytes[i + 2])) {
                        out.push((h << 4) | l);
                        i += 3;
                        continue;
                    }
                }
                out.push(bytes[i]);
                i += 1;
            }
            return String::from_utf8(out).ok();
        }
    }
    None
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

fn handle_oauth_connection(mut stream: TcpStream, expected_nonce: &str) -> Option<String> {
    let mut buf = [0u8; 8192];
    let _ = stream.set_read_timeout(Some(Duration::from_secs(10)));
    let n = stream.read(&mut buf).ok()?;
    let req = String::from_utf8_lossy(&buf[..n]);
    let first_line = req.lines().next().unwrap_or("");
    // e.g. GET /oauth/callback?token=...&nonce=... HTTP/1.1
    let mut parts = first_line.split_whitespace();
    let _method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("/");

    let (path_only, query) = match path.split_once('?') {
        Some((p, q)) => (p, q),
        None => (path, ""),
    };

    let mut token: Option<String> = None;
    if path_only == "/oauth/callback" {
        let nonce = parse_query_param(query, "nonce").unwrap_or_default();
        if nonce == expected_nonce {
            token = parse_query_param(query, "token");
        }
    }

    // Include a data: favicon so Chrome won't make a follow-up /favicon.ico request
    // after the one-shot server has already exited.
    let body = if token.is_some() {
        "<!doctype html><html><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width,initial-scale=1'/><title>IT Asset Agent</title><link rel='icon' href='data:,'/><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;padding:32px;background:#f7f7fb;color:#222} .card{max-width:560px;margin:0 auto;background:#fff;border:1px solid #e6e6ef;border-radius:14px;padding:24px} h2{margin:0 0 8px 0} p{margin:0;color:#555}</style></head><body><div class='card'><h2>Authentication successful</h2><p>You can close this tab and return to the Agent.</p></div></body></html>"
    } else {
        "<!doctype html><html><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width,initial-scale=1'/><title>IT Asset Agent</title><link rel='icon' href='data:,'/><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;padding:32px;background:#f7f7fb;color:#222} .card{max-width:560px;margin:0 auto;background:#fff;border:1px solid #e6e6ef;border-radius:14px;padding:24px} h2{margin:0 0 8px 0} p{margin:0;color:#555}</style></head><body><div class='card'><h2>Authentication failed</h2><p>Return to the Agent and try again.</p></div></body></html>"
    };
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
    token
}

#[tauri::command]
fn start_oauth_callback_server(app: AppHandle) -> Result<serde_json::Value, String> {
    // Random-ish nonce without extra deps
    let nonce = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos()
        .to_string();

    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("Failed to bind localhost: {}", e))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get local addr: {}", e))?
        .port();

    let app_handle = app.clone();
    let expected_nonce = nonce.clone();

    thread::spawn(move || {
        // Accept a single connection and then exit
        if let Ok((stream, _addr)) = listener.accept() {
            if let Some(token) = handle_oauth_connection(stream, &expected_nonce) {
                let _ = app_handle.emit(
                    "oauth-token",
                    serde_json::json!({ "token": token, "nonce": expected_nonce }),
                );
            }
        }
    });

    Ok(serde_json::json!({ "port": port, "nonce": nonce }))
}

#[tauri::command]
async fn get_user_from_token(token: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = "https://it-asset-project-production.up.railway.app/api/auth/me";

    let response = client
        .get(url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Token validation failed: {}", error_text));
    }

    response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Invalid response: {}", e))
}

// Tauri commands
#[tauri::command]
async fn login_user(username: String, password: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = "https://it-asset-project-production.up.railway.app/api/auth/login";
    
    let login_data = LoginRequest { username, password };
    
    let response = client
        .post(url)
        .json(&login_data)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Login failed: {}", error_text));
    }
    
    let login_response: LoginResponse = response
        .json()
        .await
        .map_err(|e| format!("Invalid response: {}", e))?;
    
    Ok(login_response.token)
}

#[tauri::command]
fn get_agent_status() -> String {
    "Monitoring Active".to_string()
}

#[tauri::command]
async fn send_usage_data(
    data: UsageData,
    config: AgentConfig,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/agent/usage", config.api_url);
    
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", config.auth_token))
        .json(&data)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if response.status().is_success() {
        Ok("Data sent successfully".to_string())
    } else {
        Err(format!("Failed to send data: {}", response.status()))
    }
}

#[tauri::command]
async fn send_heartbeat(config: AgentConfig) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/agent/heartbeat", config.api_url);
    
    let payload = serde_json::json!({
        "device_id": config.device_id,
        "timestamp": SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    });
    
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", config.auth_token))
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if response.status().is_success() {
        Ok("Heartbeat sent".to_string())
    } else {
        Err(format!("Heartbeat failed: {}", response.status()))
    }
}

#[tauri::command]
fn get_system_info() -> String {
    format!(
        "OS: {:?}, Kernel: {:?}, Hostname: {:?}",
        System::name(),
        System::kernel_version(),
        System::host_name()
    )
}

#[tauri::command]
async fn collect_and_send_usage(auth_token: String) -> Result<String, String> {
    let mut sys = System::new_all();
    sys.refresh_processes();
    
    let client = reqwest::Client::new();
    let url = "https://it-asset-project-production.up.railway.app/api/agent/usage";
    
    // Get device info for device_id
    let hostname = System::host_name().unwrap_or_else(|| "unknown".to_string());
    let device_id = hostname.clone(); // Use hostname as device_id
    
    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    // Send usage records one by one (API expects individual records, not array)
    let mut success_count = 0;
    let processes: Vec<_> = sys.processes().iter().take(10).collect();
    
    for (_, process) in processes {
        let usage_data = serde_json::json!({
            "device_id": device_id,
            "app_name": process.name().to_string(),
            "window_title": process.name().to_string(),
            "duration": 120, // 2 minutes in seconds
            "timestamp": timestamp
        });
        
        let response = client
            .post(url)
            .header("Authorization", format!("Bearer {}", auth_token))
            .json(&usage_data)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;
        
        if response.status().is_success() {
            success_count += 1;
        } else {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("API error: {}", error_text));
        }
    }
    
    Ok(format!("Successfully sent {} usage records", success_count))
}

// Background process monitoring
fn start_process_monitoring(handle: AppHandle) {
    thread::spawn(move || {
        let mut sys = System::new_all();
        let mut last_process_name = String::new();
        let mut start_time = SystemTime::now();
        
        loop {
            sys.refresh_processes();
            
            // Get the most active process (simplified - in production, use Windows API for foreground window)
            let current_process = sys
                .processes()
                .iter()
                .max_by_key(|(_, p)| (p.cpu_usage() * 100.0) as u64)
                .map(|(_, p)| p.name().to_string())
                .unwrap_or_else(|| "Unknown".to_string());
            
            // If process changed, emit update
            if current_process != last_process_name {
                let duration = start_time.elapsed().unwrap_or(Duration::from_secs(0)).as_secs();
                
                let usage_data = UsageData {
                    app_name: last_process_name.clone(),
                    window_title: "".to_string(),
                    duration,
                    timestamp: SystemTime::now()
                        .duration_since(SystemTime::UNIX_EPOCH)
                        .unwrap()
                        .as_secs(),
                };
                
                // Emit to React frontend
                let _ = handle.emit("usage-update", &usage_data);
                
                last_process_name = current_process.clone();
                start_time = SystemTime::now();
            }
            
            // Emit current activity every interval
            let _ = handle.emit("current-activity", &current_process);
            
            thread::sleep(Duration::from_secs(5)); // Poll every 5 seconds
        }
    });
}

// ============================================================================
// Background Thread: Forbidden App Monitoring and Alerting
// ============================================================================
// This function spawns a background thread that:
// 1. Waits for auth token to be set (via set_monitoring_token command)
// 2. Syncs forbidden app list from API every 5 minutes
// 3. Scans running processes every 60 seconds
// 4. Reports violations to backend API
// 5. Emits events to React frontend for local notifications
//
// Thread Safety:
// - Clones AUTH_TOKEN Arc (increments reference count, doesn't copy data)
// - Locks mutex only during token read (minimizes lock time)
// - Uses tokio runtime for async API calls within sync thread
//
// Error Handling:
// - Falls back to cached list if API fetch fails
// - Continues monitoring even if reporting fails
// - Logs errors to console for debugging
// ============================================================================
fn start_forbidden_app_monitoring(handle: AppHandle) {
    let token_arc = AUTH_TOKEN.clone(); // Clone Arc pointer, not the String
    thread::spawn(move || {
        let api_url = "https://it-asset-project-production.up.railway.app";
        let mut forbidden_list: Vec<ForbiddenApp> = Vec::new();
        let mut last_sync = SystemTime::UNIX_EPOCH;
        
        loop {
            // ================================================================
            // STEP 1: Read auth token from global state (thread-safe)
            // ================================================================
            let auth_token = {
                let token = token_arc.lock().unwrap(); // Acquire lock
                token.clone() // Clone the String value
            }; // Lock automatically released here
            
            // Wait for token to be set by React frontend
            if auth_token.is_empty() {
                thread::sleep(Duration::from_secs(10));
                continue;
            }
            
            // Sync forbidden list every 5 minutes
            let time_since_sync = SystemTime::now()
                .duration_since(last_sync)
                .unwrap_or(Duration::from_secs(999999));
            
            if time_since_sync.as_secs() > 300 {
                // 5 minutes
                let runtime = tokio::runtime::Runtime::new().unwrap();
                match runtime.block_on(sync_forbidden_list(api_url, &auth_token)) {
                    Ok(apps) => {
                        forbidden_list = apps;
                        last_sync = SystemTime::now();
                        println!("✅ Synced {} forbidden apps", forbidden_list.len());
                        
                        // Emit to frontend
                        let _ = handle.emit("forbidden-list-updated", forbidden_list.len());
                    }
                    Err(e) => {
                        eprintln!("❌ Failed to sync forbidden list: {}", e);
                    }
                }
            }
            
            // Scan for violations every 60 seconds
            if !forbidden_list.is_empty() {
                let violations = scan_processes(&forbidden_list);
                
                if !violations.is_empty() {
                    println!("🚨 Detected {} violations", violations.len());
                    
                    // Report each violation
                    let runtime = tokio::runtime::Runtime::new().unwrap();
                    for violation in &violations {
                        match runtime.block_on(report_violation(api_url, &auth_token, violation)) {
                            Ok(_) => {
                                println!("✅ Reported: {}", violation.app_detected);
                                
                                // Emit to frontend for local notification
                                let _ = handle.emit("violation-detected", violation);
                            }
                            Err(e) => {
                                eprintln!("❌ Failed to report violation: {}", e);
                            }
                        }
                    }
                }
            }
            
            thread::sleep(Duration::from_secs(60)); // Check every 60 seconds
        }
    });
}

// ============================================================================
// Tauri Command: Set Authentication Token for Monitoring
// ============================================================================
// Called by React frontend after successful login to enable monitoring.
//
// Flow:
// 1. User logs in via React UI
// 2. React calls: await invoke('set_monitoring_token', { token })
// 3. This function writes token to global AUTH_TOKEN
// 4. Background monitoring thread detects non-empty token
// 5. Monitoring activates and starts scanning processes
//
// Security:
// - Token printed to console is truncated (first 10 chars only)
// - Full token stored in memory, never written to disk
// - Token cleared on app restart (requires re-login)
//
// Thread Safety:
// - Locks AUTH_TOKEN mutex during write
// - Lock released automatically when function returns
// ============================================================================
#[tauri::command]
fn set_monitoring_token(token: String) -> Result<String, String> {
    let mut auth_token = AUTH_TOKEN.lock().unwrap(); // Acquire write lock
    *auth_token = token.clone(); // Dereference and assign
    println!("✅ Monitoring token set: {}...", &token.chars().take(10).collect::<String>());
    Ok("Token set successfully".to_string())
} // Lock automatically released here

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(single_instance_init(|app, _args, _cwd| {
            // When a second instance is launched, focus the existing window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        // .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .setup(|app| {
            // Build system tray menu with user-friendly labels
            let show_item = MenuItemBuilder::with_id("show", "📊 Open Dashboard").build(app)?;
            let hide_item = MenuItemBuilder::with_id("hide", "↓ Minimize to Tray").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "🚪 Exit Monitor").build(app)?;
            
            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&hide_item)
                .separator()
                .item(&quit_item)
                .build()?;
            
            // Setup system tray
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        std::process::exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    match event {
                        TrayIconEvent::Click { button, .. } => {
                            let app = tray.app_handle();
                            if button == tauri::tray::MouseButton::Left {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;
            
            // Start background process monitoring
            let handle = app.handle().clone();
            start_process_monitoring(handle.clone());
            
            // Start forbidden app monitoring
            start_forbidden_app_monitoring(handle);
            
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Hide window instead of closing
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            login_user,
            get_user_from_token,
            start_oauth_callback_server,
            get_agent_status,
            send_usage_data,
            send_heartbeat,
            get_system_info,
            collect_and_send_usage,
            set_monitoring_token
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
