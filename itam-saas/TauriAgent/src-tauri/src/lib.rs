use tauri::{AppHandle, Emitter, Manager, menu::{MenuBuilder, MenuItemBuilder}, tray::{TrayIconBuilder, TrayIconEvent}};
use std::{sync::{Arc, Mutex}, thread, time::{Duration, SystemTime}};
use sysinfo::{System, SystemExt, ProcessExt};
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

// Tauri commands
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
    let mut sys = System::new_all();
    sys.refresh_all();
    
    format!(
        "OS: {:?}, Kernel: {:?}, Hostname: {:?}",
        System::name(),
        System::kernel_version(),
        System::host_name()
    )
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
                .max_by_key(|(_, p)| p.cpu_usage() as u64)
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
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .setup(|app| {
            // Build system tray menu
            let show_item = MenuItemBuilder::with_id("show", "Show Agent").build(app)?;
            let hide_item = MenuItemBuilder::with_id("hide", "Hide to Tray").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            
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
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
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
            get_agent_status,
            send_usage_data,
            send_heartbeat,
            get_system_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
