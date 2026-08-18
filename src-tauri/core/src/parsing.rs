//! Parsers for winget output (table rows and export JSON) plus the package
//! value type. Kept free of Tauri so the fuzz targets can compile them
//! without the desktop framework.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use tracing::{debug, trace};

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

// Structs for parsing winget export JSON. Fields are pub so the app crate
// (winget_commands) can read them; the fuzz targets exercise the serde
// parser directly.
#[derive(Debug, Deserialize)]
pub struct WingetExport {
    #[serde(rename = "Sources")]
    pub sources: Option<Vec<WingetExportSource>>,
}

#[derive(Debug, Deserialize)]
pub struct WingetExportSource {
    #[serde(rename = "Packages")]
    pub packages: Option<Vec<WingetExportPackage>>,
    #[serde(rename = "SourceDetails")]
    #[allow(dead_code)]
    source_details: Option<WingetSourceDetails>,
}

#[derive(Debug, Deserialize)]
pub struct WingetExportPackage {
    #[serde(rename = "PackageIdentifier")]
    pub package_identifier: String,
}

#[derive(Debug, Deserialize)]
struct WingetSourceDetails {
    #[serde(rename = "Name")]
    #[allow(dead_code)]
    name: Option<String>,
}

/// Try to find full package ID from a potentially truncated ID.
/// Searches by exact match first, then by prefix match across all entries.
/// (pub for the fuzz targets)
pub fn resolve_full_id(truncated_id: &str, id_map: &HashMap<String, String>) -> Option<String> {
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

/// Parses winget's table output into packages. (pub for the fuzz targets)
pub fn parse_winget_table(output: &str) -> Vec<WingetPackage> {
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
