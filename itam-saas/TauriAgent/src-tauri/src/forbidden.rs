// Forbidden App Detection Module
// This module handles:
// - Fetching forbidden app list from API
// - Caching the list locally
// - Scanning running processes
// - Reporting violations

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use sysinfo::{ProcessExt, System, SystemExt};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForbiddenApp {
    pub process_name: String,
    pub severity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForbiddenAppCache {
    pub apps: Vec<ForbiddenApp>,
    pub last_updated: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViolationReport {
    pub device_id: String,
    pub app_detected: String,
    pub severity: String,
    pub process_id: u32,
}

// Track reported PIDs to avoid duplicate alerts
static mut REPORTED_PIDS: Option<HashSet<u32>> = None;

fn get_cache_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("tauriagent");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path.push("forbidden_cache.json");
    path
}

/// Fetch forbidden apps list from API
pub async fn fetch_forbidden_list(api_url: &str, token: &str) -> Result<Vec<ForbiddenApp>, String> {
    let url = format!("{}/api/forbidden-apps/list", api_url);
    
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()));
    }
    
    let apps: Vec<ForbiddenApp> = response
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;
    
    Ok(apps)
}

/// Save forbidden list to local cache
pub fn cache_to_disk(apps: &[ForbiddenApp]) -> Result<(), String> {
    let cache = ForbiddenAppCache {
        apps: apps.to_vec(),
        last_updated: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };
    
    let json = serde_json::to_string_pretty(&cache)
        .map_err(|e| format!("Serialize error: {}", e))?;
    
    fs::write(get_cache_path(), json)
        .map_err(|e| format!("File write error: {}", e))?;
    
    Ok(())
}

/// Load forbidden list from local cache
pub fn load_from_cache() -> Result<Vec<ForbiddenApp>, String> {
    let path = get_cache_path();
    
    if !path.exists() {
        return Ok(Vec::new());
    }
    
    let json = fs::read_to_string(path)
        .map_err(|e| format!("File read error: {}", e))?;
    
    let cache: ForbiddenAppCache = serde_json::from_str(&json)
        .map_err(|e| format!("Parse error: {}", e))?;
    
    Ok(cache.apps)
}

/// Scan running processes for forbidden apps
pub fn scan_processes(forbidden_list: &[ForbiddenApp]) -> Vec<ViolationReport> {
    let mut violations = Vec::new();
    let mut sys = System::new_all();
    sys.refresh_processes();
    
    // Initialize reported PIDs set
    unsafe {
        if REPORTED_PIDS.is_none() {
            REPORTED_PIDS = Some(HashSet::new());
        }
    }
    
    for (pid, process) in sys.processes() {
        let process_name = process.name().to_lowercase();
        
        // Check if this process is forbidden
        for forbidden in forbidden_list {
            if process_name.contains(&forbidden.process_name.to_lowercase()) {
                let pid_value = pid.as_u32();
                
                // Check if we've already reported this PID
                let already_reported = unsafe {
                    REPORTED_PIDS.as_ref().unwrap().contains(&pid_value)
                };
                
                if !already_reported {
                    violations.push(ViolationReport {
                        device_id: get_device_id(),
                        app_detected: process_name.clone(),
                        severity: forbidden.severity.clone(),
                        process_id: pid_value,
                    });
                    
                    // Mark as reported
                    unsafe {
                        REPORTED_PIDS.as_mut().unwrap().insert(pid_value);
                    }
                }
            }
        }
    }
    
    violations
}

/// Report violation to API
pub async fn report_violation(
    api_url: &str,
    token: &str,
    violation: &ViolationReport,
) -> Result<(), String> {
    let url = format!("{}/api/alerts", api_url);
    
    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(violation)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()));
    }
    
    Ok(())
}

/// Get device ID (hostname-based)
fn get_device_id() -> String {
    hostname::get()
        .unwrap_or_else(|_| std::ffi::OsString::from("unknown"))
        .to_string_lossy()
        .to_string()
}

/// Sync forbidden list from API and cache it
pub async fn sync_forbidden_list(api_url: &str, token: &str) -> Result<Vec<ForbiddenApp>, String> {
    match fetch_forbidden_list(api_url, token).await {
        Ok(apps) => {
            // Cache the list
            if let Err(e) = cache_to_disk(&apps) {
                eprintln!("Warning: Failed to cache forbidden list: {}", e);
            }
            Ok(apps)
        }
        Err(e) => {
            // If fetch fails, try to load from cache
            eprintln!("Failed to fetch forbidden list: {}. Loading from cache...", e);
            load_from_cache()
        }
    }
}

/// Clear reported PIDs (for testing or periodic cleanup)
pub fn clear_reported_pids() {
    unsafe {
        if let Some(ref mut pids) = REPORTED_PIDS {
            pids.clear();
        }
    }
}
