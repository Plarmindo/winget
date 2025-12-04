use std::process::Command;
use std::path::PathBuf;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Clone a git repository to a local directory
pub fn git_clone(url: &str, destination: &str) -> Result<String, String> {
    // Validate URL
    if !url.starts_with("https://") && !url.starts_with("git@") {
        return Err("Invalid repository URL".to_string());
    }

    // Create destination path
    let dest_path = PathBuf::from(destination);
    
    // Ensure parent directory exists
    if let Some(parent) = dest_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Run git clone
    let mut cmd = Command::new("git");
    cmd.args(&["clone", "--progress", url, destination]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output()
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
    cmd.args(&["-C", repo_path, "pull"]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output()
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
    cmd.args(&["-C", repo_path, "rev-parse", "--abbrev-ref", "HEAD"]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output()
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
    cmd.args(&["-C", repo_path, "status", "--porcelain"]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output()
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
