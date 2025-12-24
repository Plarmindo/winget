use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

use serde::{Deserialize, Serialize};

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
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to open stderr")?;

    let window_out = window.clone();
    let op_out = operation.to_string();
    let pkg_out = package_id.to_string();

    // Stream stdout
    let stdout_thread = std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                crate::progress::emit_progress(
                    &window_out,
                    crate::progress::ProgressEvent {
                        operation: op_out.clone(),
                        package: pkg_out.clone(),
                        percent: 0,
                        message: line,
                    },
                );
            }
        }
    });

    // Stream stderr
    let window_err = window.clone();
    let op_err = operation.to_string();
    let pkg_err = package_id.to_string();
    let stderr_thread = std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                crate::progress::emit_progress(
                    &window_err,
                    crate::progress::ProgressEvent {
                        operation: op_err.clone(),
                        package: pkg_err.clone(),
                        percent: 0,
                        message: format!("Error: {}", line),
                    },
                );
            }
        }
    });

    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for command: {}", e))?;

    let _ = stdout_thread.join();
    let _ = stderr_thread.join();

    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "Command failed with exit code: {:?}",
            status.code()
        ))
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

/// Gets all installed package IDs from winget export (returns full, non-truncated IDs)
fn get_installed_package_ids() -> Result<HashMap<String, String>, String> {
    let temp_file = std::env::temp_dir().join("winget_export_temp.json");
    let temp_path = temp_file.to_string_lossy().to_string();

    // Run winget export to get JSON with full package IDs
    let mut cmd = Command::new("winget");
    cmd.args(&["export", "-o", &temp_path, "--accept-source-agreements"]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run winget export: {}", e))?;

    if !output.status.success() {
        // Export might fail for some packages, but that's OK - just continue
        eprintln!("winget export had warnings (this is normal)");
    }

    // Read and parse the JSON file
    let json_content = std::fs::read_to_string(&temp_file)
        .map_err(|e| format!("Failed to read export file: {}", e))?;

    // Clean up temp file
    let _ = std::fs::remove_file(&temp_file);

    let export: WingetExport = serde_json::from_str(&json_content)
        .map_err(|e| format!("Failed to parse export JSON: {}", e))?;

    // Build a map of lowercase ID prefix -> full ID
    let mut id_map: HashMap<String, String> = HashMap::new();

    if let Some(sources) = export.sources {
        for source in sources {
            if let Some(packages) = source.packages {
                for pkg in packages {
                    let full_id = pkg.package_identifier.clone();
                    // Store multiple keys for matching:
                    // 1. Full ID lowercase
                    id_map.insert(full_id.to_lowercase(), full_id.clone());
                    // 2. First 30 chars lowercase (for truncated matching)
                    if full_id.len() > 30 {
                        let prefix = full_id[..30].to_lowercase();
                        id_map.insert(prefix, full_id.clone());
                    }
                }
            }
        }
    }

    eprintln!("=== LOADED {} PACKAGE IDS FROM EXPORT ===", id_map.len());
    Ok(id_map)
}

/// Try to find full package ID from a potentially truncated ID
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

    // Try prefix match (for truncated IDs)
    for (key, full_id) in id_map.iter() {
        if key.starts_with(&lower) || full_id.to_lowercase().starts_with(&lower) {
            return Some(full_id.clone());
        }
    }

    None
}

use crate::validation::{validate_package_id, validate_search_query};

pub fn run_winget_search(query: &str) -> Result<String, String> {
    if let Err(e) = validate_search_query(query) {
        return Err(e.user_message());
    }

    // Get full package IDs from export for matching
    let id_map = get_installed_package_ids().unwrap_or_default();

    // Use batch file + PowerShell hidden window approach (same as upgrade)
    let temp_dir = std::env::temp_dir();
    let output_file = temp_dir.join("winget_search_output.txt");
    let output_path = output_file.to_string_lossy().to_string();

    // Create a batch file that sets mode and runs winget search
    let batch_file = temp_dir.join("winget_search_cmd.bat");
    let batch_path = batch_file.to_string_lossy().to_string();
    let batch_content = format!(
        "@echo off\r\nmode con cols=500\r\nwinget search \"{}\" --disable-interactivity --accept-source-agreements > \"{}\" 2>&1\r\n",
        query.replace("\"", "\\\""),
        output_path
    );
    std::fs::write(&batch_file, &batch_content)
        .map_err(|e| format!("Failed to write batch file: {}", e))?;

    // Use PowerShell to run the batch file with hidden window
    let ps_cmd = format!(
        "Start-Process -FilePath 'cmd' -ArgumentList '/c','\"{}\"' -WindowStyle Hidden -Wait",
        batch_path.replace("'", "''")
    );

    let mut cmd = Command::new("powershell");
    cmd.args(&["-NoProfile", "-Command", &ps_cmd]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let _ = cmd.output();

    // Clean up batch file
    let _ = std::fs::remove_file(&batch_file);

    // Read the output file
    let stdout = std::fs::read_to_string(&output_file).unwrap_or_default();
    let _ = std::fs::remove_file(&output_file);

    eprintln!("=== WINGET SEARCH OUTPUT ===");
    eprintln!("{}", stdout);
    eprintln!("=== END SEARCH OUTPUT ===");

    // Check if no packages found
    if stdout.contains("No package found") || stdout.trim().is_empty() {
        eprintln!("=== NO PACKAGES FOUND ===");
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

    eprintln!("=== PARSED {} SEARCH PACKAGES ===", packages.len());
    serde_json::to_string(&packages).map_err(|e| e.to_string())
}

pub fn run_winget_install(package_id: &str, window: &tauri::Window) -> Result<(), String> {
    if let Err(e) = validate_package_id(package_id) {
        return Err(e.user_message());
    }

    eprintln!("=== INSTALLING: {} ===", package_id);

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

    eprintln!("=== INSTALL SUCCESSFUL ===");
    Ok(())
}

pub fn run_winget_upgrade(package_id: &str, window: &tauri::Window) -> Result<(), String> {
    if let Err(e) = validate_package_id(package_id) {
        return Err(e.user_message());
    }

    eprintln!("=== UPGRADING: {} ===", package_id);

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

    eprintln!("=== UPGRADE SUCCESSFUL ===");
    Ok(())
}

pub fn run_winget_uninstall(package_id: &str, window: &tauri::Window) -> Result<(), String> {
    if let Err(e) = validate_package_id(package_id) {
        return Err(e.user_message());
    }

    eprintln!("=== UNINSTALLING: {} ===", package_id);

    let mut cmd = Command::new("winget");
    cmd.arg("uninstall");
    cmd.arg("--id");
    cmd.arg(package_id);
    cmd.arg("--exact");
    cmd.arg("--accept-source-agreements");

    // Set wide console to prevent truncation
    cmd.env("COLUMNS", "500");

    stream_command_output(cmd, window, "uninstall", package_id)?;

    eprintln!("=== UNINSTALL SUCCESSFUL ===");
    Ok(())
}

pub fn run_winget_list() -> Result<String, String> {
    // Use winget export to get full package IDs (avoids truncation)
    let id_map = get_installed_package_ids()?;

    // Convert the export data to our package format
    let packages: Vec<WingetPackage> = id_map
        .values()
        .map(|id| WingetPackage {
            id: id.clone(),
            name: id.clone(), // We only have ID from export
            version: "installed".to_string(),
            available_version: None,
            source: Some("winget".to_string()),
            description: None,
            publisher: None,
            category: None,
            is_free: None,
        })
        .collect();

    eprintln!("=== PARSED {} INSTALLED PACKAGES ===", packages.len());
    serde_json::to_string(&packages).map_err(|e| e.to_string())
}

pub fn run_winget_upgrade_list() -> Result<String, String> {
    // Step 1: Get full package IDs from winget export
    let id_map = get_installed_package_ids().unwrap_or_default();
    eprintln!("=== GOT {} IDS FROM EXPORT ===", id_map.len());

    // Step 2: Run winget with mode con to get wider output
    // Use PowerShell Start-Process with -WindowStyle Hidden to hide the console window
    let temp_dir = std::env::temp_dir();
    let output_file = temp_dir.join("winget_upgrade_output.txt");
    let output_path = output_file.to_string_lossy().to_string();

    // Create a batch file that sets mode and runs winget
    let batch_file = temp_dir.join("winget_upgrade_cmd.bat");
    let batch_path = batch_file.to_string_lossy().to_string();
    let batch_content = format!(
        "@echo off\r\nmode con cols=500\r\nwinget upgrade --disable-interactivity --accept-source-agreements > \"{}\" 2>&1\r\n",
        output_path
    );
    std::fs::write(&batch_file, &batch_content)
        .map_err(|e| format!("Failed to write batch file: {}", e))?;

    // Use PowerShell to run the batch file with hidden window
    let ps_cmd = format!(
        "Start-Process -FilePath 'cmd' -ArgumentList '/c','\"{}\"' -WindowStyle Hidden -Wait",
        batch_path.replace("'", "''")
    );

    let mut cmd = Command::new("powershell");
    cmd.args(&["-NoProfile", "-Command", &ps_cmd]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let _ = cmd.output();

    // Clean up batch file
    let _ = std::fs::remove_file(&batch_file);

    // Read the output file
    let stdout = std::fs::read_to_string(&output_file).unwrap_or_default();
    let _ = std::fs::remove_file(&output_file);

    eprintln!("=== WINGET UPGRADE OUTPUT ===");
    eprintln!("{}", stdout);
    eprintln!("=== END UPGRADE OUTPUT ===");

    // Check for no upgrades
    if stdout.contains("No installed package found")
        || stdout.contains("No applicable update found")
        || stdout.contains("0 upgrades available")
        || stdout.trim().is_empty()
    {
        eprintln!("=== NO UPGRADES AVAILABLE ===");
        return Ok("[]".to_string());
    }

    // Step 3: Parse the table and resolve truncated IDs to full IDs
    let mut packages = parse_winget_table(&stdout);

    // Resolve truncated IDs using the export data
    for pkg in packages.iter_mut() {
        if let Some(full_id) = resolve_full_id(&pkg.id, &id_map) {
            eprintln!("Resolved '{}' -> '{}'", pkg.id, full_id);
            pkg.id = full_id;
        }
    }

    eprintln!("=== PARSED {} UPGRADE PACKAGES ===", packages.len());
    serde_json::to_string(&packages).map_err(|e| e.to_string())
}

fn parse_winget_table(output: &str) -> Vec<WingetPackage> {
    let mut packages = Vec::new();
    let lines: Vec<&str> = output.lines().collect();

    eprintln!("=== PARSER: {} lines in output ===", lines.len());

    if lines.is_empty() {
        eprintln!("=== PARSER: Empty output ===");
        return packages;
    }

    // Find separator line (all dashes)
    let separator_idx = lines.iter().position(|line| {
        let trimmed = line.trim();
        trimmed.len() > 10 && trimmed.chars().all(|c| c == '-')
    });

    let Some(sep_idx) = separator_idx else {
        eprintln!("=== PARSER: No separator line found ===");
        return packages;
    };

    eprintln!("=== PARSER: Separator at line {} ===", sep_idx);

    // Data starts after separator
    let data_start = sep_idx + 1;

    // Parse each data line using the separator line to determine column widths
    let _sep_line = lines[sep_idx];

    // For winget's table format, we'll use a simpler approach:
    // Split by 2+ spaces to find column boundaries
    for line in lines.iter().skip(data_start) {
        let trimmed = line.trim();

        // Skip empty lines and footer
        if trimmed.is_empty()
            || trimmed.contains("upgrades available")
            || trimmed.contains("packages found")
        {
            continue;
        }

        eprintln!("=== PARSER: Processing line: '{}' ===", trimmed);

        // Split by 2 or more spaces to get columns
        let parts: Vec<&str> = trimmed
            .split("  ")
            .filter(|s| !s.is_empty())
            .map(|s| s.trim())
            .collect();

        eprintln!(
            "=== PARSER: Split into {} parts: {:?} ===",
            parts.len(),
            parts
        );

        if parts.len() >= 2 {
            // Format: Name, ID, Version, [Available], [Source]
            let name = parts[0].to_string();
            let id = parts[1].to_string();
            let version = if parts.len() > 2 {
                parts[2].to_string()
            } else {
                String::new()
            };
            let available_version = if parts.len() > 3 {
                Some(parts[3].to_string())
            } else {
                None
            };
            let source = if parts.len() > 4 {
                Some(parts[4].to_string())
            } else {
                None
            };

            // Skip if ID is empty
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
    }

    eprintln!("=== PARSER: Found {} packages ===", packages.len());
    packages
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_winget_table_standard() {
        // Winget uses continuous separator lines, not segmented ones
        let output = "\
Name                           Id                          Version  Source
----------------------------------------------------------------------
Visual Studio Code             Microsoft.VisualStudioCode  1.95.0   winget
Google Chrome                  Google.Chrome               130.0    winget
";
        let packages = parse_winget_table(output);

        assert_eq!(packages.len(), 2);

        // First package: VS Code
        assert_eq!(packages[0].name, "Visual Studio Code");
        assert_eq!(packages[0].id, "Microsoft.VisualStudioCode");
        assert_eq!(packages[0].version, "1.95.0");
        assert_eq!(packages[0].source, Some("winget".to_string()));

        // Second package: Google Chrome
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
        // IDs ending with ... or … should be skipped
        let output = "\
Name                  Id             Version  Source
----------------------------------------------------
Some Package          Some.Package...  1.0.0    winget
Valid Package         Valid.Package  2.0.0    winget
";
        let packages = parse_winget_table(output);

        // Only Valid.Package should be parsed, truncated one skipped
        assert_eq!(packages.len(), 1);
        assert_eq!(packages[0].id, "Valid.Package");
    }
}
