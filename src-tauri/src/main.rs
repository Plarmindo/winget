#![cfg_attr(
use winget_commands::{run_winget_search, run_winget_install, run_winget_upgrade, run_winget_uninstall, check_admin, WingetOperationRequest, SearchRequest};
use secure_storage::{save_api_config, load_api_config, delete_api_config};
use tauri::Manager;

#[tauri::command]
async fn search_packages_command(request: SearchRequest) -> Result<String, String> {
    if request.manager != "winget" {
#![cfg_attr(
use winget_commands::{run_winget_search, run_winget_install, run_winget_upgrade, run_winget_uninstall, check_admin, WingetOperationRequest, SearchRequest};
use secure_storage::{save_api_config, load_api_config, delete_api_config};

#[tauri::command]
async fn search_packages_command(request: SearchRequest) -> Result<String, String> {
    if request.manager != "winget" {
        return Err("Only winget is supported in this backend version".to_string());
    }
    
    run_winget_search(&request.query)
}

#[tauri::command]
async fn run_winget_operation(window: tauri::Window, request: WingetOperationRequest) -> Result<(), String> {
    if request.manager != "winget" {
        return Err("Only winget is supported".to_string());
    }

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
        delete_api_config
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}