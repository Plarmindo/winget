use std::path::PathBuf;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Clone a git repository to a local directory
pub fn git_clone(url: &str, destination: &str) -> Result<String, String> {
    // Validate URL — must be HTTPS or git@ (SSH) protocol
    if !url.starts_with("https://") && !url.starts_with("git@") {
        return Err("Invalid repository URL: must start with https:// or git@".to_string());
    }

    // Security: Block file:// and other non-network protocols
    if url.starts_with("file://") || url.starts_with("ftp://") || url.starts_with("data:") {
        return Err("Only HTTPS and SSH (git@) URLs are allowed".to_string());
    }

    // Security: Validate destination path — must not contain path traversal
    let dest_path = PathBuf::from(destination);
    if destination.contains("..") {
        return Err("Destination path must not contain '..' (path traversal)".to_string());
    }

    // Security: Destination must be within user-accessible directories
    // Allow: home directory, Documents, Desktop, Downloads, temp
    let dest_canonical = if dest_path.exists() {
        dest_path
            .canonicalize()
            .map_err(|e| format!("Invalid destination path: {}", e))?
    } else {
        // Path doesn't exist yet, check parent
        if let Some(parent) = dest_path.parent() {
            if parent.as_os_str().is_empty() {
                // Relative path with no parent — reject
                return Err("Destination must be an absolute path".to_string());
            }
            if parent.exists() {
                parent
                    .canonicalize()
                    .map_err(|e| format!("Invalid parent directory: {}", e))?
            } else {
                return Err("Parent directory does not exist".to_string());
            }
        } else {
            return Err("Invalid destination path".to_string());
        }
    };

    // Block system directories
    let dest_str = dest_canonical.to_string_lossy().to_lowercase();
    let blocked_prefixes = [
        r"c:\windows",
        r"c:\program files",
        r"c:\programdata",
        r"c:\program files (x86)",
        r"\windows\system32",
        r"\windows\system",
        r"/usr/",
        r"/etc/",
        r"/var/",
        r"/sbin/",
        r"/bin/",
    ];
    for prefix in &blocked_prefixes {
        if dest_str.starts_with(prefix) {
            return Err("Cannot clone into system directories".to_string());
        }
    }

    // Ensure parent directory exists
    if let Some(parent) = dest_path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }

    // Run git clone
    let mut cmd = Command::new("git");
    cmd.args(["clone", "--progress", url, destination]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run git: {}. Is git installed?", e))?;

    if output.status.success() {
        Ok(format!("Successfully cloned to {}", destination))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Git clone failed: {}", stderr))
    }
}

/// Pull latest changes in a repository
pub fn git_pull(repo_path: &str) -> Result<String, String> {
    let path = PathBuf::from(repo_path);

    if !path.exists() {
        return Err("Repository path does not exist".to_string());
    }

    let mut cmd = Command::new("git");
    cmd.args(["-C", repo_path, "pull"]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run git pull: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Git pull failed: {}", stderr))
    }
}

/// Get current branch name
#[allow(dead_code)]
pub fn git_current_branch(repo_path: &str) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.args(["-C", repo_path, "rev-parse", "--abbrev-ref", "HEAD"]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to get branch: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err("Not a git repository".to_string())
    }
}

/// Get status of repository
pub fn git_status(repo_path: &str) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.args(["-C", repo_path, "status", "--porcelain"]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to get status: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if stdout.trim().is_empty() {
            Ok("Clean - no changes".to_string())
        } else {
            Ok(format!("Modified files:\n{}", stdout))
        }
    } else {
        Err("Not a git repository".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_invalid_url() {
        let result = git_clone("invalid-url", "/tmp/test");
        assert!(result.is_err());
    }
}
