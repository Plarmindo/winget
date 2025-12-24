use serde::{Deserialize, Serialize};

/// Structured error types for winget operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum WingetError {
    /// Admin privileges required for the operation
    InsufficientPrivileges { operation: String, help: String },

    /// Package not found in repository
    PackageNotFound {
        query: String,
        suggestions: Vec<String>,
    },

    /// Network connectivity issues
    NetworkError { message: String },

    /// Invalid input provided
    InvalidInput { field: String, reason: String },

    /// Operation not yet implemented
    OperationNotImplemented { operation: String, eta: String },

    /// Command execution failed
    CommandFailed {
        command: String,
        exit_code: i32,
        stderr_preview: String,
    },

    /// Parser failed to process output
    ParseError { message: String },

    /// Generic error with custom message
    Other { message: String },

    /// User cancelled the operation
    UserCancelled,
}

impl WingetError {
    /// Get user-friendly error message
    pub fn user_message(&self) -> String {
        match self {
            Self::InsufficientPrivileges { operation, help } => {
                format!(
                    "Administrator privileges required for '{}'.\n\n{}",
                    operation, help
                )
            }
            Self::PackageNotFound { query, suggestions } => {
                let mut msg = format!("Package '{}' not found.", query);
                if !suggestions.is_empty() {
                    msg.push_str(&format!("\n\nDid you mean: {}", suggestions.join(", ")));
                }
                msg
            }
            Self::NetworkError { message } => {
                format!(
                    "Network error: {}.\n\nPlease check your internet connection and try again.",
                    message
                )
            }
            Self::InvalidInput { field, reason } => {
                format!("Invalid {}: {}", field, reason)
            }
            Self::OperationNotImplemented { operation, eta } => {
                format!(
                    "The '{}' operation is not yet available.\n\nExpected availability: {}",
                    operation, eta
                )
            }
            Self::CommandFailed {
                command,
                exit_code,
                stderr_preview,
            } => {
                format!(
                    "Command failed: {}\nExit code: {}\n\nError: {}",
                    command, exit_code, stderr_preview
                )
            }
            Self::ParseError { message } => {
                format!("Failed to parse winget output: {}", message)
            }
            Self::UserCancelled => "Operation cancelled by user.".to_string(),
            Self::Other { message } => message.clone(),
        }
    }

    /// Get error code for frontend error handling
    #[allow(dead_code)]
    pub fn error_code(&self) -> &'static str {
        match self {
            Self::InsufficientPrivileges { .. } => "INSUFFICIENT_PRIVILEGES",
            Self::PackageNotFound { .. } => "PACKAGE_NOT_FOUND",
            Self::NetworkError { .. } => "NETWORK_ERROR",
            Self::InvalidInput { .. } => "INVALID_INPUT",
            Self::OperationNotImplemented { .. } => "NOT_IMPLEMENTED",
            Self::CommandFailed { .. } => "COMMAND_FAILED",
            Self::ParseError { .. } => "PARSE_ERROR",
            Self::UserCancelled => "USER_CANCELLED",
            Self::Other { .. } => "UNKNOWN_ERROR",
        }
    }
}

impl std::fmt::Display for WingetError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.user_message())
    }
}

impl std::error::Error for WingetError {}

/// Helper function to parse stderr and classify error type
#[allow(dead_code)]
pub fn parse_winget_error(stderr: &[u8], operation: &str) -> WingetError {
    let stderr_str = String::from_utf8_lossy(stderr).to_lowercase();

    // Check for common error patterns
    if stderr_str.contains("privilege")
        || stderr_str.contains("admin")
        || stderr_str.contains("access denied")
    {
        return WingetError::InsufficientPrivileges {
            operation: operation.to_string(),
            help: "Right-click the application and select 'Run as Administrator'.".to_string(),
        };
    }

    if stderr_str.contains("not found") || stderr_str.contains("no package found") {
        return WingetError::PackageNotFound {
            query: operation.to_string(),
            suggestions: vec![],
        };
    }

    if stderr_str.contains("network")
        || stderr_str.contains("connection")
        || stderr_str.contains("timeout")
    {
        return WingetError::NetworkError {
            message: "Unable to connect to package repository".to_string(),
        };
    }

    if stderr_str.contains("canceled")
        || stderr_str.contains("cancelled")
        || stderr_str.contains("operation was canceled")
    {
        return WingetError::UserCancelled;
    }

    // Default to command failed with sanitized error
    let preview = String::from_utf8_lossy(stderr)
        .lines()
        .filter(|line| !line.contains("C:\\Users\\")) // Remove paths
        .take(3)
        .collect::<Vec<_>>()
        .join("\n")
        .chars()
        .take(200)
        .collect();

    WingetError::CommandFailed {
        command: format!("winget {}", operation),
        exit_code: 1,
        stderr_preview: preview,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_insufficient_privileges() {
        let stderr = b"Error: This operation requires administrator privileges";
        let err = parse_winget_error(stderr, "install");

        match err {
            WingetError::InsufficientPrivileges { operation, .. } => {
                assert_eq!(operation, "install");
            }
            _ => panic!("Expected InsufficientPrivileges error"),
        }
    }

    #[test]
    fn test_parse_package_not_found() {
        let stderr = b"No package found matching input criteria.";
        let err = parse_winget_error(stderr, "NonExistent.Package");

        match err {
            WingetError::PackageNotFound { query, .. } => {
                assert_eq!(query, "NonExistent.Package");
            }
            _ => panic!("Expected PackageNotFound error"),
        }
    }

    #[test]
    fn test_error_code() {
        let err = WingetError::NetworkError {
            message: "Connection timeout".to_string(),
        };
        assert_eq!(err.error_code(), "NETWORK_ERROR");
    }

    #[test]
    fn test_user_message() {
        let err = WingetError::InvalidInput {
            field: "package_id".to_string(),
            reason: "Cannot contain spaces".to_string(),
        };
        assert!(err.user_message().contains("Invalid package_id"));
        assert!(err.user_message().contains("Cannot contain spaces"));
    }
}
