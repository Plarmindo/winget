use keyring::Entry;
use serde::{Serialize, Deserialize};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecureConfig {
    pub api_key: String,
    pub provider: String,
    pub base_url: String,
    pub model_id: String,
}

/// Save API configuration securely using OS keychain
#[tauri::command]
pub async fn save_api_config(
    _app: AppHandle,
    config: SecureConfig,
) -> Result<(), String> {
    let entry = Entry::new("winget-interface", "ai_config").map_err(|e| e.to_string())?;
    let json = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    entry.set_password(&json).map_err(|e| e.to_string())?;
    Ok(())
}

/// Load API configuration from OS keychain
#[tauri::command]
pub async fn load_api_config(_app: AppHandle) -> Result<Option<SecureConfig>, String> {
    let entry = Entry::new("winget-interface", "ai_config").map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(json) => {
            let config: SecureConfig = serde_json::from_str(&json).map_err(|e| e.to_string())?;
            Ok(Some(config))
        },
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Delete API configuration from OS keychain
#[tauri::command]
pub async fn delete_api_config(_app: AppHandle) -> Result<(), String> {
    let entry = Entry::new("winget-interface", "ai_config").map_err(|e| e.to_string())?;
    match entry.delete_password() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
        Err(e) => Err(e.to_string()),
    }
}
