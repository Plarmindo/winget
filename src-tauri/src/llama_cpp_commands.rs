use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

use llama_cpp::standard_sampler::StandardSampler;
use llama_cpp::{LlamaModel, LlamaParams, SessionParams};

struct LlamaSession {
    model: LlamaModel,
}

static LLAMA_SESSION: Lazy<Mutex<Option<LlamaSession>>> = Lazy::new(|| Mutex::new(None));

static LOADED_MODEL_PATH: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));
static LOADED_BACKEND: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));

#[derive(Serialize, Deserialize, Clone)]
pub struct LlamaModelInfo {
    pub name: String,
    pub path: String,
    pub size: String,
}

#[derive(Serialize, Deserialize)]
pub struct LocalModelInfo {
    pub loaded: bool,
    pub model_path: Option<String>,
    pub backend: Option<String>,
}

#[tauri::command]
pub async fn initialize_local_model(model_path: String, backend: String) -> Result<bool, String> {
    // If model is already loaded, just return success
    {
        let loaded_path = LOADED_MODEL_PATH
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        if loaded_path
            .as_ref()
            .map(|p| p == &model_path)
            .unwrap_or(false)
        {
            return Ok(true);
        }
    }

    let mut session_guard = LLAMA_SESSION
        .lock()
        .map_err(|e| format!("Session lock error: {}", e))?;

    if session_guard.is_some() {
        // Unload existing model
        *session_guard = None;
    }

    let model = LlamaModel::load_from_file(&model_path, LlamaParams::default())
        .map_err(|e| format!("Failed to load model: {}", e))?;

    *session_guard = Some(LlamaSession { model });
    *LOADED_MODEL_PATH
        .lock()
        .map_err(|e| format!("Model path lock error: {}", e))? = Some(model_path.clone());
    *LOADED_BACKEND
        .lock()
        .map_err(|e| format!("Backend lock error: {}", e))? = Some(backend);

    Ok(true)
}

#[tauri::command]
pub async fn initialize_llama_model(model_path: String) -> Result<String, String> {
    let result = initialize_local_model(model_path, "llama.cpp".to_string()).await?;
    if result {
        Ok("Model initialized successfully".to_string())
    } else {
        Err("Failed to initialize model".to_string())
    }
}

#[tauri::command]
pub async fn is_local_model_loaded() -> Result<bool, String> {
    let session_guard = LLAMA_SESSION
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    Ok(session_guard.is_some())
}

#[tauri::command]
pub async fn get_local_model_info() -> Result<Option<LocalModelInfo>, String> {
    let loaded = is_local_model_loaded().await?;
    if !loaded {
        return Ok(None);
    }

    let model_path = LOADED_MODEL_PATH
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?
        .clone();
    let backend = LOADED_BACKEND
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?
        .clone();

    Ok(Some(LocalModelInfo {
        loaded: true,
        model_path,
        backend,
    }))
}

#[tauri::command]
pub async fn list_llama_models() -> Result<Vec<LlamaModelInfo>, String> {
    let mut models = Vec::new();

    // Scan common model directories for .gguf files
    let mut search_dirs = vec![
        std::path::PathBuf::from("./models"),
        std::env::current_dir().unwrap_or_default().join("models"),
    ];

    // Also check user's home directory for common model locations
    if let Ok(home) = std::env::var("USERPROFILE") {
        search_dirs.push(
            std::path::PathBuf::from(home.clone())
                .join(".cache")
                .join("lm-studio")
                .join("models"),
        );
        search_dirs.push(
            std::path::PathBuf::from(home)
                .join(".cache")
                .join("llama.cpp"),
        );
    }

    for dir in &search_dirs {
        if dir.exists() {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().is_some_and(|ext| ext == "gguf") {
                        let name = path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("unknown")
                            .to_string();
                        let size = std::fs::metadata(&path)
                            .map(|m| format_size(m.len()))
                            .unwrap_or_else(|_| "Unknown".to_string());
                        models.push(LlamaModelInfo {
                            name,
                            path: path.to_string_lossy().to_string(),
                            size,
                        });
                    }
                }
            }
        }
    }

    // If no models found, return empty list (frontend should handle this gracefully)
    Ok(models)
}

/// Format file size in human-readable format
fn format_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_idx = 0;
    while size >= 1024.0 && unit_idx < UNITS.len() - 1 {
        size /= 1024.0;
        unit_idx += 1;
    }
    format!("{:.1}{}", size, UNITS[unit_idx])
}

#[tauri::command]
pub async fn generate_local_text(
    prompt: String,
    max_tokens: Option<usize>,
    temperature: Option<f32>,
) -> Result<String, String> {
    let max_tokens = max_tokens.unwrap_or(128);
    let _temperature = temperature.unwrap_or(0.7);

    // Acquire the model and create a session inside a blocking task so we don't
    // stall the async runtime during inference.
    let result = tokio::task::spawn_blocking(move || {
        let session_guard = LLAMA_SESSION
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        let session = session_guard.as_ref().ok_or("Model not initialized")?;

        let mut ctx = session
            .model
            .create_session(SessionParams::default())
            .map_err(|e| format!("Failed to create session: {}", e))?;

        ctx.advance_context(&prompt)
            .map_err(|e| format!("Failed to feed prompt: {}", e))?;

        let handle = ctx
            .start_completing_with(StandardSampler::default(), max_tokens)
            .map_err(|e| format!("Failed to start completion: {}", e))?;

        Ok(handle.into_string())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?;

    result
}

#[tauri::command]
pub async fn generate_text(prompt: String, max_tokens: Option<usize>) -> Result<String, String> {
    generate_local_text(prompt, max_tokens, Some(0.7)).await
}

#[tauri::command]
pub async fn unload_local_model() -> Result<bool, String> {
    let mut session_guard = LLAMA_SESSION
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    *session_guard = None;
    *LOADED_MODEL_PATH
        .lock()
        .map_err(|e| format!("Lock error: {}", e))? = None;
    *LOADED_BACKEND
        .lock()
        .map_err(|e| format!("Lock error: {}", e))? = None;
    Ok(true)
}

#[tauri::command]
pub async fn unload_llama_model() -> Result<String, String> {
    unload_local_model().await?;
    Ok("Model unloaded successfully".to_string())
}
