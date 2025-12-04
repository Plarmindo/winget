#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::Manager;
use winget_commands::{run_winget_search, run_winget_install, run_winget_upgrade, run_winget_uninstall, run_winget_list, run_winget_upgrade_list, WingetOperationRequest, SearchRequest};
use secure_storage::{save_api_config, load_api_config, delete_api_config};

mod winget_commands;
mod package_managers;
mod secure_storage;
mod errors;
mod validation;
mod progress;
mod ollama_commands;
mod git_commands;

#[derive(Clone, serde::Serialize)]
struct Payload {
  args: Vec<String>,
  cwd: String,
}

#[tauri::command]
async fn search_packages_command(request: SearchRequest) -> Result<String, String> {
    match request.manager.as_str() {
        "winget" => run_winget_search(&request.query),
        "choco" | "chocolatey" => package_managers::run_choco_search(&request.query),
        "scoop" => package_managers::run_scoop_search(&request.query),
        "brew" => package_managers::run_brew_search(&request.query),
        "apt" => package_managers::run_apt_search(&request.query),
        _ => Err(format!("Unsupported manager: {}", request.manager)),
    }
}

#[tauri::command]
async fn run_winget_operation(window: tauri::Window, request: WingetOperationRequest) -> Result<(), String> {
    if request.manager == "winget" {
        match request.mode.as_str() {
            "install" => {
                for package_id in request.packages {
                    run_winget_install(&package_id, &window)?;
                }
            },
            "upgrade" => {
                for package_id in request.packages {
                    run_winget_upgrade(&package_id, &window)?;
                }
            },
            "uninstall" => {
                for package_id in request.packages {
                    run_winget_uninstall(&package_id, &window)?;
                }
            },
            _ => return Err(format!("Unknown operation mode: {}", request.mode)),
        }
    } else {
        // Dispatch to generic manager handler
        for package_id in request.packages {
            let manager = if request.manager == "chocolatey" { "choco" } else { &request.manager };
            package_managers::run_manager_operation(manager, &request.mode, &package_id, &window)?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn list_installed_packages_command() -> Result<String, String> {
    run_winget_list()
}

#[tauri::command]
async fn list_upgradable_packages_command() -> Result<String, String> {
    run_winget_upgrade_list()
}

#[tauri::command]
async fn save_script_to_desktop(filename: String, content: String) -> Result<String, String> {
    let desktop_path = tauri::api::path::desktop_dir()
        .ok_or("Could not resolve Desktop directory")?;
    
    let file_path = desktop_path.join(&filename);
    
    std::fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
        
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
  tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
      println!("{}, {argv:?}, {cwd}", app.package_info().name);
      app.emit_all("single-instance", Payload { args: argv, cwd }).unwrap();
    }))
    .plugin(tauri_plugin_window_state::Builder::default().build())
    .invoke_handler(tauri::generate_handler![
      search_packages_command,
      run_winget_operation,
      list_installed_packages_command,
      list_upgradable_packages_command,
      save_api_config,
      load_api_config,
      delete_api_config,
      save_script_to_desktop,
      ollama_commands::list_ollama_models,
      git_clone_repo,
      git_pull_repo,
      git_repo_status
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}