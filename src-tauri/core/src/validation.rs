use crate::errors::WingetError;
use once_cell::sync::Lazy;
use regex::Regex;
use tracing::{debug, warn};

static PACKAGE_ID_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^[@A-Za-z0-9][A-Za-z0-9._\-\\/]{0,255}$").unwrap());

pub fn validate_package_id(id: &str) -> Result<(), WingetError> {
    if id.is_empty() {
        warn!("Package ID validation failed: empty");
        return Err(WingetError::InvalidInput {
            field: "package_id".to_string(),
            reason: "Package ID cannot be empty".to_string(),
        });
    }

    if id.len() > 256 {
        warn!(len = id.len(), "Package ID validation failed: too long");
        return Err(WingetError::InvalidInput {
            field: "package_id".to_string(),
            reason: "Package ID too long (max 256 characters)".to_string(),
        });
    }

    if !PACKAGE_ID_REGEX.is_match(id) {
        warn!(id = %id, "Package ID validation failed: regex mismatch");
        return Err(WingetError::InvalidInput {
            field: "package_id".to_string(),
            reason: "Invalid format. Expected: Publisher.AppName (alphanumeric, dots, underscores, hyphens)".to_string(),
        });
    }

    debug!(id = %id, "Package ID validated successfully");
    Ok(())
}

pub fn validate_search_query(query: &str) -> Result<(), WingetError> {
    if query.len() > 256 {
        return Err(WingetError::InvalidInput {
            field: "search_query".to_string(),
            reason: "Search query too long (max 256 characters)".to_string(),
        });
    }

    // Block potential command injection patterns
    // Although we use Command::arg which handles escaping, it's good practice to reject suspicious chars
    let dangerous_chars = [';', '&', '|', '\n', '\r', '`'];
    if query.chars().any(|c| dangerous_chars.contains(&c)) {
        return Err(WingetError::InvalidInput {
            field: "search_query".to_string(),
            reason: "Query contains invalid characters".to_string(),
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_package_id_valid() {
        assert!(validate_package_id("Microsoft.VisualStudioCode").is_ok());
        assert!(validate_package_id("Google.Chrome").is_ok());
        assert!(validate_package_id("7zip.7zip").is_ok());
        assert!(validate_package_id("RustLang.Rust.1.75").is_ok());
        // GitHub repo format
        assert!(validate_package_id("microsoft/vscode").is_ok());
        assert!(validate_package_id("facebook/react").is_ok());
    }

    #[test]
    fn test_validate_package_id_invalid() {
        assert!(validate_package_id("").is_err());
        assert!(validate_package_id("Invalid ID with spaces").is_err());
        assert!(validate_package_id("; rm -rf /").is_err());
        assert!(validate_package_id(".StartWithDot").is_err());
    }

    #[test]
    fn test_validate_package_id_edge_cases() {
        // Single character valid
        assert!(validate_package_id("A").is_ok());
        // Max length (256 chars)
        let max_id = "A".repeat(256);
        assert!(validate_package_id(&max_id).is_ok());
        // Too long (257 chars)
        let too_long = "A".repeat(257);
        assert!(validate_package_id(&too_long).is_err());
        // MSIX format with backslash
        assert!(validate_package_id("MSIX\\Microsoft.Something").is_ok());
        // Underscores allowed
        assert!(validate_package_id("Some_Package.Name_Here").is_ok());
        // Hyphens allowed
        assert!(validate_package_id("Some-Package.Name-Here").is_ok());
    }

    #[test]
    fn test_validate_package_id_command_injection() {
        // Various command injection attempts
        assert!(validate_package_id("pkg; whoami").is_err());
        assert!(validate_package_id("pkg | cat /etc/passwd").is_err());
        assert!(validate_package_id("pkg && calc").is_err());
        assert!(validate_package_id("pkg`echo hacked`").is_err());
        assert!(validate_package_id("pkg\nmalicious").is_err());
        assert!(validate_package_id("$(calc)").is_err());
    }

    #[test]
    fn test_validate_search_query_valid() {
        assert!(validate_search_query("vscode").is_ok());
        assert!(validate_search_query("visual studio code").is_ok()); // Spaces are allowed in search
        assert!(validate_search_query("").is_ok()); // Empty is valid for search
        assert!(validate_search_query("C++").is_ok());
        assert!(validate_search_query("node.js").is_ok());
    }

    #[test]
    fn test_validate_search_query_invalid() {
        assert!(validate_search_query("vscode; calc").is_err());
        assert!(validate_search_query("vscode && echo hacked").is_err());
        assert!(validate_search_query("test | grep password").is_err());
        assert!(validate_search_query("`whoami`").is_err());
        assert!(validate_search_query("test\nmalicious").is_err());
    }

    #[test]
    fn test_validate_search_query_max_length() {
        let max_query = "a".repeat(256);
        assert!(validate_search_query(&max_query).is_ok());
        let too_long = "a".repeat(257);
        assert!(validate_search_query(&too_long).is_err());
    }

    #[test]
    fn test_validate_package_id_error_messages() {
        let result = validate_package_id("");
        assert!(result.is_err());
        if let Err(WingetError::InvalidInput { field, reason }) = result {
            assert_eq!(field, "package_id");
            assert!(reason.contains("empty"));
        }
    }

    #[test]
    fn test_validate_search_query_error_messages() {
        let result = validate_search_query("test; malicious");
        assert!(result.is_err());
        if let Err(WingetError::InvalidInput { field, reason }) = result {
            assert_eq!(field, "search_query");
            assert!(reason.contains("invalid characters"));
        }
    }
}
