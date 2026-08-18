use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::sync::Mutex as StdMutex;

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tracing::{debug, error, info, trace, warn};

// Parsers and value types moved to the Tauri-free winget-core crate; re-export
// here so existing paths (crate::winget_commands::WingetPackage) keep working.
pub use crate::parsing::{parse_winget_table, resolve_full_id, WingetExport, WingetPackage};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn stream_command_output(
    mut cmd: Command,
    window: &tauri::Window,
    operation: &str,
    package_id: &str,
) -> Result<(), String> {
    // Merge stdout and stderr to avoid duplicate messages.
    // Winget often writes the same progress to both streams.
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    let mut stdout = child.stdout.take().ok_or("Failed to open stdout")?;
    let mut stderr = child.stderr.take().ok_or("Failed to open stderr")?;

    let window_out = window.clone();
    let op_out = operation.to_string();
    let pkg_out = package_id.to_string();

    // Use a single thread that reads both streams interleaved, deduplicating output
    let handle = std::thread::spawn(move || {
        use std::io::Read;
        let mut stdout_buf = [0u8; 4096];
        let mut stderr_buf = [0u8; 4096];
        let mut stdout_done = false;
        let mut stderr_done = false;
        let mut seen_lines: std::collections::HashSet<String> = std::collections::HashSet::new();

        while !stdout_done || !stderr_done {
            // Read from stdout
            if !stdout_done {
                match stdout.read(&mut stdout_buf) {
                    Ok(0) => stdout_done = true,
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&stdout_buf[..n]);
                        for line in text.lines() {
                            let trimmed = line.trim();
                            if !trimmed.is_empty() && seen_lines.insert(trimmed.to_string()) {
                                crate::progress::emit_progress(
                                    &window_out,
                                    crate::progress::ProgressEvent {
                                        operation: op_out.clone(),
                                        package: pkg_out.clone(),
                                        percent: 0,
                                        message: trimmed.to_string(),
                                    },
                                );
                            }
                        }
                    }
                    Err(_) => stdout_done = true,
                }
            }
            // Read from stderr
            if !stderr_done {
                match stderr.read(&mut stderr_buf) {
                    Ok(0) => stderr_done = true,
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&stderr_buf[..n]);
                        for line in text.lines() {
                            let trimmed = line.trim();
                            if !trimmed.is_empty() && seen_lines.insert(trimmed.to_string()) {
                                crate::progress::emit_progress(
                                    &window_out,
                                    crate::progress::ProgressEvent {
                                        operation: op_out.clone(),
                                        package: pkg_out.clone(),
                                        percent: 0,
                                        message: format!("Error: {}", trimmed),
                                    },
                                );
                            }
                        }
                    }
                    Err(_) => stderr_done = true,
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    });

    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for command: {}", e))?;

    let _ = handle.join();

    if status.success() {
        Ok(())
    } else {
        let code = status.code();
        let friendly = match code {
            Some(-1978335189) => " — Another installation is already in progress. Wait for it to finish and try again.".to_string(),
            Some(-1978335212) => " — Installation is blocked by system policy.".to_string(),
            Some(-1978335215) => " — The package is currently in use. Close the application and try again.".to_string(),
            Some(-1978335231) => " — An internal WinGet error occurred.".to_string(),
            Some(-1978335229) => " — Administrator privileges required. Run as Administrator.".to_string(),
            Some(-1978335226) => " — Network error: unable to reach the repository.".to_string(),
            Some(-1978335225) => " — Package not found in the repository.".to_string(),
            Some(-1978335224) => " — You must accept the package agreements before installing.".to_string(),
            Some(-1978335222) => " — No applicable upgrade found.".to_string(),
            Some(-1978335221) => " — Upgrade is not supported for this package.".to_string(),
            Some(-2147009240) => " — The package is already installed or a deployment conflict occurred. Try uninstalling first.".to_string(),
            Some(c) if c < 0 => format!(" (0x{:08X})", c as u32),
            _ => String::new(),
        };
        let message = format!("Command failed with exit code: {:?}{}", code, friendly);
        error!(exit_code = code, error = %message, "winget command failed");
        Err(message)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WingetOperationRequest {
    pub manager: String,
    pub mode: String,
    pub packages: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchRequest {
    pub manager: String,
    pub query: String,
}

/// Cache entry: timestamp of the snapshot plus the full ID map
pub type ExportCache = Option<(std::time::Instant, HashMap<String, String>)>;

/// Cached export data with timestamp for TTL-based invalidation
static EXPORT_CACHE: Lazy<StdMutex<ExportCache>> = Lazy::new(|| StdMutex::new(None));

/// Gets all installed package IDs from winget export (returns full, non-truncated IDs).
/// Results are cached for 30 seconds to avoid repeated shell calls.
fn get_installed_package_ids() -> Result<HashMap<String, String>, String> {
    // Check cache first
    {
        let cache = EXPORT_CACHE
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        if let Some((timestamp, ref id_map)) = *cache {
            if timestamp.elapsed() < std::time::Duration::from_secs(30) {
                debug!(ids = id_map.len(), "Using cached export data");
                return Ok(id_map.clone());
            }
        }
    }

    // Run winget export
    let unique_id = format!(
        "winget_export_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );
    let temp_file = std::env::temp_dir().join(&unique_id);
    let temp_path = temp_file.to_string_lossy().to_string();

    let mut cmd = Command::new("winget");
    cmd.args([
        "export",
        "-o",
        temp_path.as_str(),
        "--accept-source-agreements",
    ]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(|e| {
        // Clean up temp file on command failure
        let _ = std::fs::remove_file(&temp_file);
        format!("Failed to run winget export: {}", e)
    })?;

    if !output.status.success() {
        warn!("winget export had warnings (this is normal)");
    }

    // Read and parse the JSON file
    let json_content = match std::fs::read_to_string(&temp_file) {
        Ok(content) => content,
        Err(e) => {
            let _ = std::fs::remove_file(&temp_file);
            return Err(format!("Failed to read export file: {}", e));
        }
    };

    // Clean up temp file
    let _ = std::fs::remove_file(&temp_file);

    let export: WingetExport = serde_json::from_str(&json_content)
        .map_err(|e| format!("Failed to parse export JSON: {}", e))?;

    // Build a map of lowercase full ID -> full ID (no prefix collisions)
    let mut id_map: HashMap<String, String> = HashMap::new();

    if let Some(sources) = export.sources {
        for source in sources {
            if let Some(packages) = source.packages {
                for pkg in packages {
                    let full_id = pkg.package_identifier.clone();
                    id_map.insert(full_id.to_lowercase(), full_id);
                }
            }
        }
    }

    // Update cache
    if let Ok(mut cache) = EXPORT_CACHE.lock() {
        *cache = Some((std::time::Instant::now(), id_map.clone()));
    }

    info!(
        count = id_map.len(),
        "Loaded package IDs from winget export"
    );
    Ok(id_map)
}

use crate::validation::{validate_package_id, validate_search_query};

#[tracing::instrument(fields(query = %query))]
pub fn run_winget_search(query: &str) -> Result<String, String> {
    if let Err(e) = validate_search_query(query) {
        return Err(e.user_message());
    }

    // Get full package IDs from export for matching
    let id_map = get_installed_package_ids().unwrap_or_default();

    // Run winget search directly via Command::arg() — no shell, no PowerShell, no injection.
    // Output goes to stderr (winget writes progress there); capture both streams.
    let mut cmd = Command::new("winget");
    cmd.args([
        "search",
        "--id",
        query,
        "--disable-interactivity",
        "--accept-source-agreements",
    ]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(|e| {
        let message = format!("Failed to run winget search: {}", e);
        error!(error = %message, "winget search command failed");
        message
    })?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    trace!(output_len = stdout.len(), "Winget search output received");

    // Check if no packages found
    if stdout.contains("No package found") || stdout.trim().is_empty() {
        info!(count = 0, "Search complete");
        return Ok("[]".to_string());
    }

    // Parse and resolve IDs
    let mut packages = parse_winget_table(&stdout);

    // Try to resolve truncated IDs
    for pkg in packages.iter_mut() {
        if let Some(full_id) = resolve_full_id(&pkg.id, &id_map) {
            pkg.id = full_id;
        }
    }

    info!(count = packages.len(), "Search complete");
    serde_json::to_string(&packages).map_err(|e| e.to_string())
}

#[tracing::instrument(skip(window), fields(package = %package_id))]
pub fn run_winget_install(package_id: &str, window: &tauri::Window) -> Result<(), String> {
    if let Err(e) = validate_package_id(package_id) {
        return Err(e.user_message());
    }

    info!(package = package_id, "Starting install operation");

    let mut cmd = Command::new("winget");
    cmd.arg("install");
    cmd.arg("--id");
    cmd.arg(package_id);
    cmd.arg("--exact");
    cmd.arg("--accept-source-agreements");
    cmd.arg("--accept-package-agreements");

    // Set wide console to prevent truncation
    cmd.env("COLUMNS", "500");

    stream_command_output(cmd, window, "install", package_id)?;

    info!(package = package_id, "Install successful");
    Ok(())
}

#[tracing::instrument(skip(window), fields(package = %package_id))]
pub fn run_winget_upgrade(package_id: &str, window: &tauri::Window) -> Result<(), String> {
    if let Err(e) = validate_package_id(package_id) {
        return Err(e.user_message());
    }

    info!(package = package_id, "Starting upgrade operation");

    let mut cmd = Command::new("winget");
    cmd.arg("upgrade");
    cmd.arg("--id");
    cmd.arg(package_id);
    cmd.arg("--exact");
    cmd.arg("--accept-source-agreements");
    cmd.arg("--accept-package-agreements");

    // Set wide console to prevent truncation
    cmd.env("COLUMNS", "500");

    stream_command_output(cmd, window, "upgrade", package_id)?;

    info!(package = package_id, "Upgrade successful");
    Ok(())
}

#[tracing::instrument(skip(window), fields(package = %package_id))]
pub fn run_winget_uninstall(package_id: &str, window: &tauri::Window) -> Result<(), String> {
    if let Err(e) = validate_package_id(package_id) {
        return Err(e.user_message());
    }

    info!(package = package_id, "Starting uninstall operation");

    let mut cmd = Command::new("winget");
    cmd.arg("uninstall");
    cmd.arg("--id");
    cmd.arg(package_id);
    cmd.arg("--exact");
    cmd.arg("--accept-source-agreements");

    // Set wide console to prevent truncation
    cmd.env("COLUMNS", "500");

    stream_command_output(cmd, window, "uninstall", package_id)?;

    info!(package = package_id, "Uninstall successful");
    Ok(())
}

#[tracing::instrument]
pub fn run_winget_list() -> Result<String, String> {
    // Run winget list to get package names and versions (with wide columns to avoid truncation)
    let mut cmd = Command::new("winget");
    cmd.args([
        "list",
        "--disable-interactivity",
        "--accept-source-agreements",
    ]);
    cmd.env("COLUMNS", "500");

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(|e| {
        let message = format!("Failed to run winget list: {}", e);
        error!(error = %message, "winget list command failed");
        message
    })?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    trace!(output_len = stdout.len(), "Winget list output received");

    // Try parsing stdout first — this gives full name/version metadata
    let packages = parse_winget_table(&stdout);
    if !packages.is_empty() {
        info!(count = packages.len(), "List complete");
        return serde_json::to_string(&packages).map_err(|e| e.to_string());
    }

    // Fall back to export data when winget list produces no parseable output.
    // Export only provides IDs (no names/versions), but at least they're correct.
    let id_map = get_installed_package_ids()?;
    let packages: Vec<WingetPackage> = id_map
        .values()
        .map(|id| WingetPackage {
            id: id.clone(),
            name: id.clone(),
            version: "installed".to_string(),
            available_version: None,
            source: Some("winget".to_string()),
            description: None,
            publisher: None,
            category: None,
            is_free: None,
        })
        .collect();

    info!(count = packages.len(), "List complete (export fallback)");
    serde_json::to_string(&packages).map_err(|e| e.to_string())
}

#[tracing::instrument]
pub fn run_winget_upgrade_list() -> Result<String, String> {
    // Step 1: Get full package IDs from winget export
    let id_map = get_installed_package_ids().unwrap_or_default();
    debug!(count = id_map.len(), "Got IDs from export for upgrade list");

    // Step 2: Run winget upgrade directly, capturing output
    let mut cmd = Command::new("winget");
    cmd.args([
        "upgrade",
        "--disable-interactivity",
        "--accept-source-agreements",
    ]);
    // Set wide columns to prevent ID truncation in table output
    cmd.env("COLUMNS", "500");

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(|e| {
        let message = format!("Failed to run winget upgrade: {}", e);
        error!(error = %message, "winget upgrade list command failed");
        message
    })?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    trace!(
        stdout_len = stdout.len(),
        stderr_len = stderr.len(),
        "Winget upgrade output received"
    );

    // Combine stdout and stderr for parsing (winget sometimes outputs to stderr)
    let combined = format!("{}\n{}", stdout, stderr);

    // Check for no upgrades (use word boundaries to avoid substring matches like "20" containing "0")
    let no_upgrades = combined.lines().any(|line| {
        let trimmed = line.trim();
        trimmed == "No installed package found"
            || trimmed == "No applicable update found"
            || trimmed.starts_with("0 upgrades available")
    });

    if no_upgrades || combined.trim().is_empty() {
        info!(count = 0, "Upgrade list complete");
        return Ok("[]".to_string());
    }

    // Step 3: Parse the table and resolve truncated IDs to full IDs
    let mut packages = parse_winget_table(&combined);

    // Resolve truncated IDs using the export data
    for pkg in packages.iter_mut() {
        if let Some(full_id) = resolve_full_id(&pkg.id, &id_map) {
            debug!(truncated = %pkg.id, full = %full_id, "Resolved truncated package ID");
            pkg.id = full_id;
        }
    }

    info!(count = packages.len(), "Upgrade list complete");
    serde_json::to_string(&packages).map_err(|e| e.to_string())
}
