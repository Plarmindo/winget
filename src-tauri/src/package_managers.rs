use std::process::Command;
use crate::winget_commands::WingetPackage;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn create_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

pub fn run_choco_search(query: &str) -> Result<String, String> {
    if cfg!(not(target_os = "windows")) {
        return Err("Chocolatey is only supported on Windows".to_string());
    }
    let mut cmd = create_command("choco");
    cmd.arg("search");
    cmd.arg(query);
    cmd.arg("--limit-output");

    let output = cmd.output().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            "Chocolatey is not installed or not in PATH. Please install Chocolatey to use this provider.".to_string()
        } else {
            format!("Failed to execute choco: {}", e)
        }
    })?;
    
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut packages = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 2 {
            packages.push(WingetPackage {
                id: parts[0].to_string(),
                name: parts[0].to_string(),
                version: parts[1].to_string(),
                available_version: None,
                source: Some("chocolatey".to_string()),
                description: if parts.len() > 2 { Some(parts[2].to_string()) } else { None },
                publisher: None,
                category: None,
                is_free: None,
            });
        }
    }

    serde_json::to_string(&packages).map_err(|e| e.to_string())
}

pub fn run_scoop_search(query: &str) -> Result<String, String> {
    if cfg!(not(target_os = "windows")) {
        return Err("Scoop is only supported on Windows".to_string());
    }
    let mut cmd = create_command("scoop");
    cmd.arg("search");
    cmd.arg(query);

    let mut output_result = cmd.output();

    // Fallback to absolute path if not found in PATH
    if let Err(ref e) = output_result {
        if e.kind() == std::io::ErrorKind::NotFound {
            if let Ok(user_profile) = std::env::var("USERPROFILE") {
                let fallback_path = std::path::PathBuf::from(user_profile)
                    .join("scoop")
                    .join("shims")
                    .join("scoop.cmd");
                
                if fallback_path.exists() {
                    if let Some(path_str) = fallback_path.to_str() {
                        let mut cmd = create_command(path_str);
                        cmd.arg("search");
                        cmd.arg(query);
                        output_result = cmd.output();
                    }
                }
            }
        }
    }

    let output = output_result.map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            "Scoop is not installed or not in PATH. Please install Scoop to use this provider.".to_string()
        } else {
            format!("Failed to execute scoop: {}", e)
        }
    })?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("unable to access") || stderr.contains("connect to server") {
            return Err("Scoop failed to connect to the remote repository. Please check your internet connection, VPN, or proxy settings.".to_string());
        }
        return Err(stderr.to_string());
    }
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut packages = Vec::new();
    let mut parsing_table = false;

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() || line.ends_with("bucket:") || line.starts_with("'") || line.starts_with("Results from") {
            continue;
        }

        // Check for table header separator
        if line.starts_with("----") {
            parsing_table = true;
            continue;
        }

        if parsing_table {
            // Parse table row: Name Version ...
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let name = parts[0];
                let version = parts[1];
                packages.push(WingetPackage {
                    id: name.to_string(),
                    name: name.to_string(),
                    version: version.to_string(),
                    available_version: None,
                    source: Some("scoop".to_string()),
                    description: None,
                    publisher: None,
                    category: None,
                    is_free: None,
                });
            }
        } else if let Some(start_paren) = line.rfind('(') {
            // Parse old format: name (version)
            if let Some(end_paren) = line.rfind(')') {
                let name = line[..start_paren].trim();
                let version = line[start_paren+1..end_paren].trim();
                
                packages.push(WingetPackage {
                    id: name.to_string(),
                    name: name.to_string(),
                    version: version.to_string(),
                    available_version: None,
                    source: Some("scoop".to_string()),
                    description: None,
                    publisher: None,
                    category: None,
                    is_free: None,
                });
            }
        }
    }

    serde_json::to_string(&packages).map_err(|e| e.to_string())
}

pub fn run_brew_search(query: &str) -> Result<String, String> {
    let mut cmd = create_command("brew");
    cmd.arg("search");
    cmd.arg("--eval"); // Returns JSON-like or structured text? No, brew search is text. 
    // brew search --desc query returns: name: description
    cmd.arg(query);

    let output = cmd.output().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            "Homebrew is not installed or not in PATH.".to_string()
        } else {
            format!("Failed to execute brew: {}", e)
        }
    })?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut packages = Vec::new();

    // Brew output is just a list of names usually
    for line in stdout.lines() {
        let name = line.trim();
        if !name.is_empty() && !name.contains("==>") {
             packages.push(WingetPackage {
                id: name.to_string(),
                name: name.to_string(),
                version: "latest".to_string(), // Brew doesn't show version in search easily
                available_version: None,
                source: Some("homebrew".to_string()),
                description: None,
                publisher: None,
                category: None,
                is_free: None,
            });
        }
    }
    serde_json::to_string(&packages).map_err(|e| e.to_string())
}

pub fn run_apt_search(query: &str) -> Result<String, String> {
    let mut cmd = create_command("apt-cache");
    cmd.arg("search");
    cmd.arg(query);

    let output = cmd.output().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            "apt-cache is not found. Is this a Debian/Ubuntu system?".to_string()
        } else {
            format!("Failed to execute apt-cache: {}", e)
        }
    })?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut packages = Vec::new();

    // Output: name - description
    for line in stdout.lines() {
        if let Some(idx) = line.find(" - ") {
            let name = line[..idx].trim();
            let desc = line[idx+3..].trim();
            packages.push(WingetPackage {
                id: name.to_string(),
                name: name.to_string(),
                version: "latest".to_string(),
                available_version: None,
                source: Some("apt".to_string()),
                description: Some(desc.to_string()),
                publisher: None,
                category: None,
                is_free: Some(true),
            });
        }
    }
    serde_json::to_string(&packages).map_err(|e| e.to_string())
}

pub fn run_manager_operation(manager: &str, mode: &str, package_id: &str, window: &tauri::Window) -> Result<(), String> {
    let cmd_name = match manager {
        "choco" => "choco",
        "scoop" => "scoop",
        "brew" => "brew",
        "apt" => "apt-get", // apt-get for install/remove
        "npm" => "npm",
        "pip" => "pip",
        _ => return Err(format!("Unsupported manager: {}", manager)),
    };

    let mut args = Vec::new();
    
    match manager {
        "choco" => {
            match mode {
                "install" => { args.push("install"); args.push(package_id); args.push("-y"); },
                "upgrade" => { args.push("upgrade"); args.push(package_id); args.push("-y"); },
                "uninstall" => { args.push("uninstall"); args.push(package_id); args.push("-y"); },
                _ => return Err(format!("Unknown mode: {}", mode)),
            }
        },
        "scoop" => {
            match mode {
                "install" => { args.push("install"); args.push(package_id); },
                "upgrade" => { args.push("update"); args.push(package_id); },
                "uninstall" => { args.push("uninstall"); args.push(package_id); },
                _ => return Err(format!("Unknown mode: {}", mode)),
            }
        },
        "brew" => {
             match mode {
                "install" => { args.push("install"); args.push(package_id); },
                "upgrade" => { args.push("upgrade"); args.push(package_id); },
                "uninstall" => { args.push("uninstall"); args.push(package_id); },
                _ => return Err(format!("Unknown mode: {}", mode)),
            }
        },
        "apt" => {
             // apt-get requires sudo usually, which might be an issue for GUI apps
             args.push("-y");
             match mode {
                "install" => { args.push("install"); args.push(package_id); },
                "upgrade" => { args.push("install"); args.push("--only-upgrade"); args.push(package_id); },
                "uninstall" => { args.push("remove"); args.push(package_id); },
                _ => return Err(format!("Unknown mode: {}", mode)),
            }
        },
        _ => return Err(format!("Manager {} not fully implemented yet", manager)),
    }

    crate::progress::emit_progress(window, crate::progress::ProgressEvent {
        operation: mode.to_string(),
        package: package_id.to_string(),
        percent: 0,
        message: format!("Running {} {}...", manager, mode),
    });

    let mut cmd = create_command(cmd_name);
    cmd.args(&args);
    
    // Use output() to capture stdout/stderr
    let mut output_result = cmd.output();

    // Fallback for Scoop
    if let Err(ref e) = output_result {
        if manager == "scoop" && e.kind() == std::io::ErrorKind::NotFound {
             if let Ok(user_profile) = std::env::var("USERPROFILE") {
                let fallback_path = std::path::PathBuf::from(user_profile)
                    .join("scoop")
                    .join("shims")
                    .join("scoop.cmd");
                
                if fallback_path.exists() {
                    if let Some(path_str) = fallback_path.to_str() {
                        let mut cmd = create_command(path_str);
                        cmd.args(&args);
                        output_result = cmd.output();
                    }
                }
            }
        }
    }

    let output = output_result
        .map_err(|e| format!("Failed to start {}: {}", manager, e))?;

    if output.status.success() {
        crate::progress::emit_progress(window, crate::progress::ProgressEvent {
            operation: mode.to_string(),
            package: package_id.to_string(),
            percent: 100,
            message: format!("Successfully {}ed {}", mode, package_id),
        });
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        Err(format!("{} failed with exit code: {:?}\nStderr: {}\nStdout: {}", manager, output.status.code(), stderr, stdout))
    }
}
