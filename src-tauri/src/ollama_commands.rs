use std::process::Command;
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
pub async fn list_ollama_models() -> Result<Vec<String>, String> {
    let output = Command::new("ollama")
        .arg("list")
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to execute ollama: {}", e))?;

    if !output.status.success() {
        return Err(format!("Ollama command failed: {}", String::from_utf8_lossy(&output.stderr)));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut models = Vec::new();

    // Parse output:
    // NAME            ID              SIZE    MODIFIED
    // llama3:latest   ...
    
    for (i, line) in stdout.lines().enumerate() {
        if i == 0 { continue; } // Skip header
        let parts: Vec<&str> = line.split_whitespace().collect();
        if let Some(name) = parts.first() {
            models.push(name.to_string());
        }
    }

    Ok(models)
}
