use std::sync::Mutex;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

use llama_cpp::{LlamaModel, LlamaParams, SessionParams};
use llama_cpp::standard_sampler::StandardSampler;

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
        let loaded_path = LOADED_MODEL_PATH.lock().unwrap();
        if loaded_path.as_ref().map(|p| p == &model_path).unwrap_or(false) {
            return Ok(true);
        }
    }

    let mut session_guard = LLAMA_SESSION.lock().unwrap();

    if session_guard.is_some() {
        // Unload existing model
        *session_guard = None;
    }

    let model = LlamaModel::load_from_file(&model_path, LlamaParams::default())
        .map_err(|e| format!("Failed to load model: {}", e))?;

    *session_guard = Some(LlamaSession { model });
    *LOADED_MODEL_PATH.lock().unwrap() = Some(model_path.clone());
    *LOADED_BACKEND.lock().unwrap() = Some(backend);

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
    let session_guard = LLAMA_SESSION.lock().unwrap();
    Ok(session_guard.is_some())
}

#[tauri::command]
pub async fn get_local_model_info() -> Result<Option<LocalModelInfo>, String> {
    let loaded = is_local_model_loaded().await?;
    if !loaded {
        return Ok(None);
    }
    
    let model_path = LOADED_MODEL_PATH.lock().unwrap().clone();
    let backend = LOADED_BACKEND.lock().unwrap().clone();
    
    Ok(Some(LocalModelInfo {
        loaded: true,
        model_path,
        backend,
    }))
}

#[tauri::command]
pub async fn list_llama_models() -> Result<Vec<LlamaModelInfo>, String> {
    let models = vec![
        LlamaModelInfo {
            name: "llama3:latest".to_string(),
            path: "./models/llama3.gguf".to_string(),
            size: "4.7GB".to_string(),
        },
        LlamaModelInfo {
            name: "mistral:latest".to_string(),
            path: "./models/mistral.gguf".to_string(),
            size: "4.1GB".to_string(),
        },
        LlamaModelInfo {
            name: "phi-3-mini:latest".to_string(),
            path: "./models/phi-3-mini.gguf".to_string(),
            size: "2.3GB".to_string(),
        },
    ];

    Ok(models)
}

#[tauri::command]
pub async fn generate_local_text(prompt: String, max_tokens: Option<usize>, temperature: Option<f32>) -> Result<String, String> {
    let max_tokens = max_tokens.unwrap_or(128);
    let _temperature = temperature.unwrap_or(0.7);

    // Acquire the model and create a session inside a blocking task so we don't
    // stall the async runtime during inference.
    let result = tokio::task::spawn_blocking(move || {
        let session_guard = LLAMA_SESSION.lock().unwrap();
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
    let mut session_guard = LLAMA_SESSION.lock().unwrap();
    *session_guard = None;
    *LOADED_MODEL_PATH.lock().unwrap() = None;
    *LOADED_BACKEND.lock().unwrap() = None;
    Ok(true)
}

#[tauri::command]
pub async fn unload_llama_model() -> Result<String, String> {
    unload_local_model().await?;
    Ok("Model unloaded successfully".to_string())
}


