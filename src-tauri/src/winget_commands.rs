use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::sync::Mutex as StdMutex;

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tracing::{debug, error, info, trace, warn};

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
#[serde(rename_all = "camelCase")]
pub struct WingetPackage {
    pub id: String,
    pub name: String,
    pub version: String,
    pub available_version: Option<String>,
    pub source: Option<String>,
    pub description: Option<String>,
    pub publisher: Option<String>,
    pub category: Option<String>,
    pub is_free: Option<bool>,
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

// Structs for parsing winget export JSON
#[derive(Debug, Deserialize)]
struct WingetExport {
    #[serde(rename = "Sources")]
    sources: Option<Vec<WingetExportSource>>,
}

#[derive(Debug, Deserialize)]
struct WingetExportSource {
    #[serde(rename = "Packages")]
    packages: Option<Vec<WingetExportPackage>>,
    #[serde(rename = "SourceDetails")]
    #[allow(dead_code)]
    source_details: Option<WingetSourceDetails>,
}

#[derive(Debug, Deserialize)]
struct WingetExportPackage {
    #[serde(rename = "PackageIdentifier")]
    package_identifier: String,
}

#[derive(Debug, Deserialize)]
struct WingetSourceDetails {
    #[serde(rename = "Name")]
    #[allow(dead_code)]
    name: Option<String>,
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

/// Try to find full package ID from a potentially truncated ID.
/// Searches by exact match first, then by prefix match across all entries.
fn resolve_full_id(truncated_id: &str, id_map: &HashMap<String, String>) -> Option<String> {
    let clean_id = truncated_id
        .trim()
        .trim_end_matches('…')
        .trim_end_matches("...");
    let lower = clean_id.to_lowercase();

    // Try exact match first
    if let Some(full) = id_map.get(&lower) {
        return Some(full.clone());
    }

    // Try prefix match (for truncated IDs) — scans all entries but avoids hash collisions
    for (key, full_id) in id_map.iter() {
        if key.starts_with(&lower) || full_id.to_lowercase().starts_with(&lower) {
            return Some(full_id.clone());
        }
    }

    None
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

fn parse_winget_table(output: &str) -> Vec<WingetPackage> {
    let mut packages = Vec::new();
    let lines: Vec<&str> = output.lines().collect();

    trace!(line_count = lines.len(), "Parsing winget table output");

    if lines.is_empty() {
        trace!("Empty output, nothing to parse");
        return packages;
    }

    // Find separator line (all dashes)
    let separator_idx = lines.iter().position(|line| {
        let trimmed = line.trim();
        trimmed.len() > 10 && trimmed.chars().all(|c| c == '-')
    });

    let Some(sep_idx) = separator_idx else {
        trace!("No separator line found in winget output");
        return packages;
    };

    if sep_idx == 0 {
        return packages;
    }

    // Use the header line (before the separator) to determine exact column byte offsets.
    // This is more robust than splitting by spaces, which fails when a name fills its column
    // exactly and leaves only one space before the Id column.
    //
    // winget's progress spinner uses bare \r to overwrite itself, so when captured to a file
    // all spinner frames land on the same \n-delimited line as the table header. We take the
    // last \r-delimited segment to get just the actual header text.
    let header_raw = lines[sep_idx - 1];
    let header_line = header_raw
        .split('\r')
        .next_back()
        .unwrap_or(header_raw)
        .trim_start();
    let id_col = match header_line.find("Id") {
        Some(pos) => pos,
        None => {
            trace!("'Id' column not found in header");
            return packages;
        }
    };
    let name_col = header_line.find("Name").unwrap_or(0);
    let version_col = header_line.find("Version");
    let available_col = header_line.find("Available");
    let source_col = header_line.find("Source");

    trace!(
        name_col,
        id_col,
        ?version_col,
        ?available_col,
        ?source_col,
        "Parsed column positions"
    );

    // Extract the text between two byte positions (walking to valid char boundaries).
    fn extract_col(line: &str, start: usize, end: Option<usize>) -> String {
        let len = line.len();
        if start >= len {
            return String::new();
        }
        let start = (start..=len)
            .find(|&i| line.is_char_boundary(i))
            .unwrap_or(len);
        let end = match end {
            Some(e) => (e..=len).find(|&i| line.is_char_boundary(i)).unwrap_or(len),
            None => len,
        };
        if start >= end {
            return String::new();
        }
        line[start..end].trim().to_string()
    }

    for line in lines.iter().skip(sep_idx + 1) {
        let trimmed = line.trim();

        // Skip empty lines and footer messages
        if trimmed.is_empty()
            || trimmed.contains("upgrades available")
            || trimmed.contains("packages found")
            || trimmed.contains("package(s) have version numbers")
        {
            continue;
        }

        trace!(line = trimmed, "Processing data line");

        let name = extract_col(line, name_col, Some(id_col));
        let id = extract_col(line, id_col, version_col.or(source_col));
        let version = version_col
            .map(|v| extract_col(line, v, available_col.or(source_col)))
            .unwrap_or_default();
        let available_version = available_col.and_then(|a| {
            let v = extract_col(line, a, source_col);
            if v.is_empty() {
                None
            } else {
                Some(v)
            }
        });
        let source = source_col.and_then(|s| {
            let v = extract_col(line, s, None);
            if v.is_empty() {
                None
            } else {
                Some(v)
            }
        });

        // Skip truncated IDs — they cannot be installed as-is and would fail validation.
        // resolve_full_id() in the caller will attempt to match them from the export map.
        if id.ends_with("...") || id.ends_with('…') {
            trace!(id = %id, "Skipping truncated ID");
            continue;
        }

        trace!(name = %name, id = %id, version = %version, "Parsed package row");

        if !id.is_empty() && !name.is_empty() {
            packages.push(WingetPackage {
                id,
                name,
                version,
                available_version,
                source,
                description: None,
                publisher: None,
                category: None,
                is_free: None,
            });
        }
    }

    debug!(count = packages.len(), "Table parser found packages");
    packages
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- parse_winget_table tests (existing) ---

    #[test]
    fn test_parse_winget_table_standard() {
        let output = "\
Name                           Id                          Version  Source
----------------------------------------------------------------------
Visual Studio Code             Microsoft.VisualStudioCode  1.95.0   winget
Google Chrome                  Google.Chrome               130.0    winget
";
        let packages = parse_winget_table(output);

        assert_eq!(packages.len(), 2);
        assert_eq!(packages[0].name, "Visual Studio Code");
        assert_eq!(packages[0].id, "Microsoft.VisualStudioCode");
        assert_eq!(packages[0].version, "1.95.0");
        assert_eq!(packages[0].source, Some("winget".to_string()));
        assert_eq!(packages[1].name, "Google Chrome");
        assert_eq!(packages[1].id, "Google.Chrome");
        assert_eq!(packages[1].version, "130.0");
    }

    #[test]
    fn test_parse_winget_table_varying_widths() {
        let output = "\
Name                           Id                  Version   Source
--------------------------------------------------------------------
Discord                        Discord.Discord     1.0.9000  winget
Python 3.12 (64-bit)           Python.Python.3.12  3.12.0    winget
";
        let packages = parse_winget_table(output);
        assert_eq!(packages.len(), 2);
        assert_eq!(packages[0].name, "Discord");
        assert_eq!(packages[0].id, "Discord.Discord");
        assert_eq!(packages[1].name, "Python 3.12 (64-bit)");
        assert_eq!(packages[1].id, "Python.Python.3.12");
        assert_eq!(packages[1].version, "3.12.0");
    }

    #[test]
    fn test_parse_winget_table_empty() {
        let output = "\
Name       Id       Version  Source
------------------------------------
";
        let packages = parse_winget_table(output);
        assert_eq!(packages.len(), 0);
    }

    #[test]
    fn test_parse_winget_table_no_header() {
        let output = "Some random text without proper header\n";
        let packages = parse_winget_table(output);
        assert_eq!(packages.len(), 0);
    }

    #[test]
    fn test_parse_winget_table_single_word_name() {
        let output = "\
Name  Id                    Version  Source
--------------------------------------------
OBS   OBSProject.OBSStudio  30.0     winget
";
        let packages = parse_winget_table(output);
        assert_eq!(packages.len(), 1);
        assert_eq!(packages[0].name, "OBS");
        assert_eq!(packages[0].id, "OBSProject.OBSStudio");
    }

    #[test]
    fn test_parse_winget_table_no_source_column() {
        let output = "\
Name                Id                          Version
-------------------------------------------------------
Visual Studio Code  Microsoft.VisualStudioCode  1.95.0
";
        let packages = parse_winget_table(output);
        assert_eq!(packages.len(), 1);
        assert_eq!(packages[0].name, "Visual Studio Code");
        assert_eq!(packages[0].source, None);
    }

    #[test]
    fn test_parse_winget_table_special_characters() {
        let output = "\
Name                  Id             Version  Source
----------------------------------------------------
7-Zip File Manager    7zip.7zip      23.01    winget
Node.js               OpenJS.NodeJS  20.11.0  winget
";
        let packages = parse_winget_table(output);
        assert_eq!(packages.len(), 2);
        assert_eq!(packages[0].name, "7-Zip File Manager");
        assert_eq!(packages[0].id, "7zip.7zip");
        assert_eq!(packages[1].name, "Node.js");
        assert_eq!(packages[1].id, "OpenJS.NodeJS");
    }

    #[test]
    fn test_parse_winget_table_truncated_id_skipped() {
        let output = "\
Name                  Id             Version  Source
----------------------------------------------------
Some Package          Some.Package...  1.0.0    winget
Valid Package         Valid.Package  2.0.0    winget
";
        let packages = parse_winget_table(output);
        assert_eq!(packages.len(), 1);
        assert_eq!(packages[0].id, "Valid.Package");
    }

    // --- New integration-style tests ---

    /// Realistic winget list output with Available version column
    #[test]
    fn test_parse_winget_list_with_available_column() {
        let output = "\
Name                Id                          Version    Available  Source
-------------------------------------------------------------------------------
Visual Studio Code  Microsoft.VisualStudioCode  1.94.0     1.95.0     winget
PowerToys           Microsoft.PowerToys         0.88.0     0.89.0     winget
";
        let packages = parse_winget_table(output);
        assert_eq!(packages.len(), 2);
        assert_eq!(packages[0].name, "Visual Studio Code");
        assert_eq!(packages[0].id, "Microsoft.VisualStudioCode");
        assert_eq!(packages[0].version, "1.94.0");
        assert_eq!(packages[0].available_version, Some("1.95.0".to_string()));
        assert_eq!(packages[1].name, "PowerToys");
        assert_eq!(packages[1].id, "Microsoft.PowerToys");
        assert_eq!(packages[1].version, "0.88.0");
        assert_eq!(packages[1].available_version, Some("0.89.0".to_string()));
    }

    /// Verifies serialized JSON round-trips correctly
    #[test]
    fn test_list_output_serializes_to_json() {
        let output = "\
Name                Id                          Version  Source
---------------------------------------------------------------
Visual Studio Code  Microsoft.VisualStudioCode  1.95.0   winget
";
        let packages = parse_winget_table(output);
        let json = serde_json::to_string(&packages).unwrap();
        let parsed: Vec<WingetPackage> = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].name, "Visual Studio Code");
        assert_eq!(parsed[0].id, "Microsoft.VisualStudioCode");
        assert_eq!(parsed[0].version, "1.95.0");
    }

    /// When parser receives only a header with no data rows, it returns empty
    #[test]
    fn test_parse_winget_list_header_only() {
        let output = "\
Name                Id                          Version  Source
---------------------------------------------------------------
";
        let packages = parse_winget_table(output);
        assert_eq!(packages.len(), 0);
    }

    /// Verifies the swinget header with \r spinner artifacts is handled
    #[test]
    fn test_parse_winget_list_with_spinner_artifacts() {
        let output = "\
\r                                                                                \rName                           Id                          Version  Source
----------------------------------------------------------------------
Visual Studio Code             Microsoft.VisualStudioCode  1.95.0   winget
";
        let packages = parse_winget_table(output);
        assert_eq!(packages.len(), 1);
        assert_eq!(packages[0].name, "Visual Studio Code");
        assert_eq!(packages[0].id, "Microsoft.VisualStudioCode");
    }

    // --- resolve_full_id tests ---

    fn make_id_map(ids: &[&str]) -> HashMap<String, String> {
        ids.iter()
            .map(|&id| (id.to_lowercase(), id.to_string()))
            .collect()
    }

    #[test]
    fn test_resolve_full_id_exact_match() {
        let map = make_id_map(&["Microsoft.VisualStudioCode", "Google.Chrome"]);
        assert_eq!(
            resolve_full_id("Microsoft.VisualStudioCode", &map),
            Some("Microsoft.VisualStudioCode".to_string())
        );
        assert_eq!(
            resolve_full_id("microsoft.visualstudiocode", &map),
            Some("Microsoft.VisualStudioCode".to_string())
        );
    }

    #[test]
    fn test_resolve_full_id_prefix_match() {
        let map = make_id_map(&["Microsoft.VisualStudioCode.With.Extra.Suffix"]);
        // Truncated ID (e.g., 30-char limit) should match by prefix
        assert_eq!(
            resolve_full_id("Microsoft.VisualStudioCode", &map),
            Some("Microsoft.VisualStudioCode.With.Extra.Suffix".to_string())
        );
    }

    #[test]
    fn test_resolve_full_id_no_match() {
        let map = make_id_map(&["Some.Other.Package"]);
        assert_eq!(resolve_full_id("NonExistent.Package", &map), None);
    }

    #[test]
    fn test_resolve_full_id_cleans_ellipsis() {
        let map = make_id_map(&["Microsoft.VisualStudioCode.With.Extra.Suffix"]);
        assert_eq!(
            resolve_full_id("Microsoft.VisualStudioCod…", &map),
            Some("Microsoft.VisualStudioCode.With.Extra.Suffix".to_string())
        );
        assert_eq!(
            resolve_full_id("Microsoft.VisualStud...", &map),
            Some("Microsoft.VisualStudioCode.With.Extra.Suffix".to_string())
        );
    }

    #[test]
    fn test_resolve_full_id_empty_map() {
        let map: HashMap<String, String> = HashMap::new();
        assert_eq!(resolve_full_id("anything", &map), None);
    }

    // --- WingetExport JSON parsing tests ---

    #[test]
    fn test_parse_export_json_basic() {
        let json = r#"{
            "Sources": [{
                "Packages": [
                    { "PackageIdentifier": "Microsoft.VisualStudioCode" },
                    { "PackageIdentifier": "Google.Chrome" }
                ]
            }]
        }"#;
        let export: WingetExport = serde_json::from_str(json).unwrap();
        let sources = export.sources.unwrap();
        let packages = sources[0].packages.as_ref().unwrap();
        assert_eq!(packages.len(), 2);
        assert_eq!(packages[0].package_identifier, "Microsoft.VisualStudioCode");
        assert_eq!(packages[1].package_identifier, "Google.Chrome");
    }

    #[test]
    fn test_parse_export_json_empty() {
        let json = r#"{ "Sources": [] }"#;
        let export: WingetExport = serde_json::from_str(json).unwrap();
        assert!(export.sources.unwrap().is_empty());
    }

    #[test]
    fn test_parse_export_json_no_sources() {
        let json = r#"{}"#;
        let export: WingetExport = serde_json::from_str(json).unwrap();
        assert!(export.sources.is_none());
    }

    // --- End-to-end: parse → serialize → verify frontend contract ---

    /// Simulates the full run_winget_list flow: parse realistic winget list
    /// output, serialize to JSON, and verify camelCase fields the frontend expects.
    #[test]
    fn test_run_winget_list_flow_parse_and_serialize() {
        // Realistic "winget list" output with Available and Source columns.
        // The last package has no Available version — winget leaves that column blank.
        let stdout = "\
Name                Id                          Version    Available  Source
-------------------------------------------------------------------------------
Visual Studio Code  Microsoft.VisualStudioCode  1.94.0     1.95.0     winget
PowerToys           Microsoft.PowerToys         0.88.0     0.89.0     winget
7-Zip               7zip.7zip                   24.09                           
";
        // Step 1: parse (same as run_winget_list)
        let packages = parse_winget_table(stdout);
        assert_eq!(packages.len(), 3, "should parse all three packages");

        // Step 2: serialize (same as run_winget_list returns)
        let json = serde_json::to_string(&packages).unwrap();

        // Step 3: verify frontend contract — JSON uses camelCase field names
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        let arr = parsed.as_array().unwrap();
        let first = &arr[0];

        // Frontend expects camelCase keys: id, name, version, availableVersion, source
        assert!(first.get("id").is_some(), "missing 'id' field");
        assert!(first.get("name").is_some(), "missing 'name' field");
        assert!(first.get("version").is_some(), "missing 'version' field");
        assert!(first.get("source").is_some(), "missing 'source' field");

        assert_eq!(first["id"], "Microsoft.VisualStudioCode");
        assert_eq!(first["name"], "Visual Studio Code");
        assert_eq!(first["version"], "1.94.0");
        assert_eq!(first["availableVersion"], "1.95.0");
        assert_eq!(first["source"], "winget");

        // Package without Available version (and no explicit source) should have null availableVersion
        let third = &arr[2];
        assert_eq!(third["availableVersion"], serde_json::Value::Null);
        assert_eq!(third["id"], "7zip.7zip");
        assert_eq!(third["name"], "7-Zip");
    }
}
