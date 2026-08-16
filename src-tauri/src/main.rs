#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use secure_storage::{
    delete_api_config, delete_github_token, load_api_config, load_github_token, save_api_config,
    save_github_token,
};
use tauri::{Emitter, State};
use tokio::sync::Mutex;
use winget_commands::{
    run_winget_install, run_winget_list, run_winget_search, run_winget_uninstall,
    run_winget_upgrade, run_winget_upgrade_list, SearchRequest, WingetOperationRequest,
};

mod errors;
mod git_commands;
mod installer_commands;
mod llama_cpp_commands;
mod package_managers;
mod progress;
mod secure_storage;
mod validation;
mod winget_commands;

use tracing_subscriber::{fmt, EnvFilter};

#[derive(Clone, serde::Serialize)]
struct Payload {
    args: Vec<String>,
    cwd: String,
}

// Global lock to prevent concurrent winget operations (exit code -1978335212)
struct WingetLock(Mutex<()>);

#[tauri::command]
async fn search_packages_command(
    request: SearchRequest,
    winget_lock: State<'_, WingetLock>,
) -> Result<String, String> {
    // Acquire lock if using winget or if potentially conflicting
    if request.manager == "winget" {
        let _guard = winget_lock.0.lock().await;
        run_winget_search(&request.query)
    } else {
        match request.manager.as_str() {
            "choco" | "chocolatey" => package_managers::run_choco_search(&request.query),
            "scoop" => package_managers::run_scoop_search(&request.query),
            "brew" => package_managers::run_brew_search(&request.query),
            "apt" => package_managers::run_apt_search(&request.query),
            _ => Err(format!("Unsupported manager: {}", request.manager)),
        }
    }
}

#[tauri::command]
async fn run_winget_operation(
    window: tauri::Window,
    request: WingetOperationRequest,
    winget_lock: State<'_, WingetLock>,
) -> Result<(), String> {
    // Always lock for operations?
    // Yes, safer, although other managers might be fine.
    // If it is winget, we MUST lock.
    if request.manager == "winget" {
        let _guard = winget_lock.0.lock().await;
        match request.mode.as_str() {
            "install" => {
                for package_id in request.packages {
                    run_winget_install(&package_id, &window)?;
                }
            }
            "upgrade" => {
                for package_id in request.packages {
                    run_winget_upgrade(&package_id, &window)?;
                }
            }
            "uninstall" => {
                for package_id in request.packages {
                    run_winget_uninstall(&package_id, &window)?;
                }
            }
            _ => return Err(format!("Unknown operation mode: {}", request.mode)),
        }
    } else {
        // We probably don't need to lock for other managers unless they conflict with winget?
        // Let's not lock them for now to allow concurrency there.
        for package_id in request.packages {
            let manager = if request.manager == "chocolatey" {
                "choco"
            } else {
                &request.manager
            };
            package_managers::run_manager_operation(manager, &request.mode, &package_id, &window)?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn list_installed_packages_command(
    winget_lock: State<'_, WingetLock>,
) -> Result<String, String> {
    let _guard = winget_lock.0.lock().await;
    run_winget_list()
}

#[tauri::command]
async fn list_upgradable_packages_command(
    winget_lock: State<'_, WingetLock>,
) -> Result<String, String> {
    let _guard = winget_lock.0.lock().await;
    run_winget_upgrade_list()
}

#[tauri::command]
async fn save_script_to_desktop(
    app: tauri::AppHandle,
    filename: String,
    content: String,
) -> Result<String, String> {
    use tauri::Manager;

    // Validate filename to prevent path traversal and invalid characters
    if filename.is_empty() {
        return Err("Filename cannot be empty".to_string());
    }

    // Reject path traversal attempts
    if filename.contains("..") || filename.contains('\\') || filename.contains('/') {
        return Err("Invalid filename: path traversal not allowed".to_string());
    }

    // Only allow .bat, .ps1, .sh extensions
    let valid_extensions = [".bat", ".ps1", ".sh"];
    let filename_lower = filename.to_lowercase();
    if !valid_extensions
        .iter()
        .any(|ext| filename_lower.ends_with(ext))
    {
        return Err("Invalid filename: must have .bat, .ps1, or .sh extension".to_string());
    }

    // Validate content for security (reject dangerous patterns)
    let dangerous_patterns = ["rm -rf", "del /s", "format", "fdisk", "shutdown"];
    if dangerous_patterns
        .iter()
        .any(|pattern| content.to_lowercase().contains(pattern))
    {
        return Err("Script content contains dangerous commands".to_string());
    }

    let desktop_path = app
        .path()
        .desktop_dir()
        .map_err(|_| "Could not resolve Desktop directory")?;

    let file_path = desktop_path.join(&filename);

    std::fs::write(&file_path, content).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn git_clone_repo(url: String, destination: String) -> Result<String, String> {
    git_commands::git_clone(&url, &destination)
}

#[tauri::command]
async fn git_pull_repo(repo_path: String) -> Result<String, String> {
    git_commands::git_pull(&repo_path)
}

#[tauri::command]
async fn git_repo_status(repo_path: String) -> Result<String, String> {
    git_commands::git_status(&repo_path)
}

fn main() {
    // Initialize structured logging with env-filter support.
    // Set RUST_LOG=debug for verbose output, or leave unset for info-level defaults.
    fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    tracing::info!(
        "Starting WinGet System Manager v{}",
        env!("CARGO_PKG_VERSION")
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            println!("{}, {argv:?}, {cwd}", app.package_info().name);
            let _ = app.emit("single-instance", Payload { args: argv, cwd });
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(WingetLock(Mutex::new(()))) // -- Initialize Global Lock --
        .invoke_handler(tauri::generate_handler![
            search_packages_command,
            run_winget_operation,
            list_installed_packages_command,
            list_upgradable_packages_command,
            save_api_config,
            load_api_config,
            delete_api_config,
            save_github_token,
            load_github_token,
            delete_github_token,
            save_script_to_desktop,
            llama_cpp_commands::list_llama_models,
            llama_cpp_commands::initialize_llama_model,
            llama_cpp_commands::initialize_local_model,
            llama_cpp_commands::generate_text,
            llama_cpp_commands::generate_local_text,
            llama_cpp_commands::unload_llama_model,
            llama_cpp_commands::unload_local_model,
            llama_cpp_commands::is_local_model_loaded,
            llama_cpp_commands::get_local_model_info,
            git_clone_repo,
            git_pull_repo,
            git_repo_status,
            installer_commands::download_and_install_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
