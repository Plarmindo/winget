use std::process::Command;
use std::os::windows::process::CommandExt;
use serde::{Deserialize, Serialize};
use encoding_rs_io::DecodeReaderBytesBuilder;
use std::io::Read;
use crate::errors::{WingetError, parse_winget_error};

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Serialize, Deserialize)]
pub struct WingetPackage {
    pub id: String,
    pub name: String,
    pub version: String,
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

use crate::validation::{validate_package_id, validate_search_query};

pub fn run_winget_search(query: &str) -> Result<String, String> {
    if let Err(e) = validate_search_query(query) {
        return Err(e.user_message());
    }

    let mut cmd = Command::new("winget");
    cmd.arg("search");
    cmd.arg(query);
    // Force English locale to ensure consistent output headers
    cmd.args(&["--locale", "en-US"]);
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute winget: {}", e))?;
    
    if !output.status.success() {
        let err = parse_winget_error(&output.stderr, "search");
        return Err(err.user_message());
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    
    let packages = parse_winget_table(&stdout);
    serde_json::to_string(&packages).map_err(|e| e.to_string())
}

pub fn run_winget_install(package_id: &str, _window: &tauri::Window) -> Result<(), String> {
    if let Err(e) = validate_package_id(package_id) {
        return Err(e.user_message());
    }

    let mut cmd = Command::new("winget");
    cmd.arg("install");
    cmd.arg("--id");
    cmd.arg(package_id);
    cmd.args(&["--locale", "en-US"]);
    cmd.arg("--accept-source-agreements");
    cmd.arg("--accept-package-agreements");
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute winget install: {}", e))?;

    if !output.status.success() {
         let err = parse_winget_error(&output.stderr, "install");
         return Err(err.user_message());
    }
    Ok(())
}

pub fn run_winget_upgrade(package_id: &str, _window: &tauri::Window) -> Result<(), String> {
    if let Err(e) = validate_package_id(package_id) {
        return Err(e.user_message());
    }

    let mut cmd = Command::new("winget");
    cmd.arg("upgrade");
    cmd.arg("--id");
    cmd.arg(package_id);
    cmd.args(&["--locale", "en-US"]);
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute winget upgrade: {}", e))?;

    if !output.status.success() {
         let err = parse_winget_error(&output.stderr, "upgrade");
         return Err(err.user_message());
    }
    Ok(())
}

pub fn run_winget_uninstall(package_id: &str, _window: &tauri::Window) -> Result<(), String> {
    if let Err(e) = validate_package_id(package_id) {
        return Err(e.user_message());
    }

    let mut cmd = Command::new("winget");
    cmd.arg("uninstall");
    cmd.arg("--id");
    cmd.arg(package_id);
    cmd.args(&["--locale", "en-US"]);
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute winget uninstall: {}", e))?;

    if !output.status.success() {
         let err = parse_winget_error(&output.stderr, "uninstall");
         return Err(err.user_message());
    }
    Ok(())
}


fn parse_winget_table(output: &str) -> Vec<WingetPackage> {
    let mut packages = Vec::new();
    let lines: Vec<&str> = output.lines().collect();

    if lines.len() < 2 {
        return packages;
    }

    // Find the header line and the separator line
    let mut header_index = None;
    let mut separator_index = None;

    for (i, line) in lines.iter().enumerate() {
        if line.starts_with("Name") && line.contains("Id") && line.contains("Version") {
            header_index = Some(i);
        } else if line.starts_with("---") {
            separator_index = Some(i);
        }
    }

    if header_index.is_none() || separator_index.is_none() {
        return packages;
    }

    let header_line = lines[header_index.unwrap()];
    
    // Determine column positions based on header
    let name_start = 0;
    let id_start = header_line.find("Id").unwrap_or(0);
    let version_start = header_line.find("Version").unwrap_or(0);
    let source_start = header_line.find("Source").unwrap_or(0);

    // Ensure we have valid indices (simple check)
    if id_start == 0 || version_start == 0 {
        return packages;
    }

    for line in lines.iter().skip(separator_index.unwrap() + 1) {
        if line.trim().is_empty() {
            continue;
        }

        // Helper to safely slice string
        let get_col = |start: usize, end: usize| -> String {
            if start >= line.len() {
                return String::new();
            }
            let actual_end = std::cmp::min(end, line.len());
            line[start..actual_end].trim().to_string()
        };

        // Calculate end positions based on next column start
        // Note: This is a simplification. Winget output is fixed-width but dynamic.
        // A more robust way is to use the header indices as minimum start points.
        
        let name = get_col(name_start, id_start);
        let id = get_col(id_start, version_start);
        let version = get_col(version_start, source_start);
        
        // Source is the last column, so take until end
        let source = if source_start > 0 {
            Some(line.chars().skip(source_start).collect::<String>().trim().to_string())
        } else {
            None
        };

        if !name.is_empty() && !id.is_empty() {
            packages.push(WingetPackage {
                id,
                name,
                version,
                source,
                description: None,
                publisher: None,
                category: None,
                is_free: None,
            });
        }
    }

    packages
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_winget_table_standard() {
        let output = "Name                           Id                          Version  Source\n--------------------------------------------------------------------------\nVisual Studio Code             Microsoft.VisualStudioCode  1.95.0   winget\nGoogle Chrome                  Google.Chrome               130.0    winget\n";
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
        let output = "Name                           Id              Version  Source\n------------------------------------------------------------------\nDiscord                        Discord.Discord 1.0.9000 winget\nPython 3.12 (64-bit)           Python.Python.3.12  3.12.0   winget\n";
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
        let output = "Name      Id      Version  Source\n--------------------------------\n";
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
        let output = "Name      Id              Version  Source\n-----------------------------------------\nOBS       OBSProject.OBSStudio  30.0     winget\n";
        let packages = parse_winget_table(output);
        
        assert_eq!(packages.len(), 1);
        assert_eq!(packages[0].name, "OBS");
        assert_eq!(packages[0].id, "OBSProject.OBSStudio");
    }

    #[test]
    fn test_parse_winget_table_no_source_column() {
        let output = "Name                Id                        Version\n------------------------------------------------------\nVisual Studio Code  Microsoft.VisualStudioCode  1.95.0\n";
        let packages = parse_winget_table(output);
        
        assert_eq!(packages.len(), 1);
        assert_eq!(packages[0].name, "Visual Studio Code");
        assert_eq!(packages[0].source, None);
    }

    #[test]
    fn test_parse_winget_table_special_characters() {
        let output = "Name                 Id              Version  Source\n-------------------------------------------------------\n7-Zip File Manager   7zip.7zip       23.01    winget\nNode.js              OpenJS.NodeJS   20.11.0  winget\n";
        let packages = parse_winget_table(output);
        
        assert_eq!(packages.len(), 2);
        assert_eq!(packages[0].name, "7-Zip File Manager");
        assert_eq!(packages[0].id, "7zip.7zip");
        assert_eq!(packages[1].name, "Node.js");
        assert_eq!(packages[1].id, "OpenJS.NodeJS");
    }
}

