use regex::Regex;
use lazy_static::lazy_static;
use crate::errors::WingetError;

lazy_static! {
    // Allow backslashes for MSIX packages like "MSIX\Microsoft.Something"
    // Allow forward slashes for GitHub repos like "owner/repo"
    static ref PACKAGE_ID_REGEX: Regex = Regex::new(r"^[A-Za-z0-9][A-Za-z0-9._\-\\/]{0,255}$").unwrap();
}

pub fn validate_package_id(id: &str) -> Result<(), WingetError> {
    if id.is_empty() {
        return Err(WingetError::InvalidInput {
            field: "package_id".to_string(),
            reason: "Package ID cannot be empty".to_string(),
        });
    }
    
    if id.len() > 256 {
        return Err(WingetError::InvalidInput {
            field: "package_id".to_string(),
            reason: "Package ID too long (max 256 characters)".to_string(),
        });
    }
    
    if !PACKAGE_ID_REGEX.is_match(id) {
        return Err(WingetError::InvalidInput {
            field: "package_id".to_string(),
            reason: "Invalid format. Expected: Publisher.AppName (alphanumeric, dots, underscores, hyphens)".to_string(),
        });
    }
    
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
    fn test_validate_search_query_valid() {
        assert!(validate_search_query("vscode").is_ok());
        assert!(validate_search_query("visual studio code").is_ok()); // Spaces are allowed in search
    }

    #[test]
    fn test_validate_search_query_invalid() {
        assert!(validate_search_query("vscode; calc").is_err());
        assert!(validate_search_query("vscode && echo hacked").is_err());
    }
}
