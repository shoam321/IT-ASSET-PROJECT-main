use tauri::{AppHandle, Emitter, Manager, menu::{MenuBuilder, MenuItemBuilder}, tray::{TrayIconBuilder, TrayIconEvent}};
use tauri_plugin_single_instance::init as single_instance_init;
use std::{thread, time::{Duration, SystemTime}};
use sysinfo::System;
use serde::{Deserialize, Serialize};

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
            start_process_monitoring(handle);
            
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
            get_agent_status,
            send_usage_data,
            send_heartbeat,
            get_system_info,
            collect_and_send_usage
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
