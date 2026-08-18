use crate::progress::{emit_progress, ProgressEvent};
use futures_util::StreamExt;
use std::io::Write;

/// Maximum download size: 2 GB
const MAX_DOWNLOAD_SIZE: u64 = 2 * 1024 * 1024 * 1024;

/// Allowed file extensions for installers
const ALLOWED_EXTENSIONS: &[&str] = &[
    ".exe",
    ".msi",
    ".msix",
    ".appx",
    ".msixbundle",
    ".appxbundle",
];

#[tauri::command]
pub async fn download_and_install_command(
    window: tauri::Window,
    url: String,
    filename: String,
    expected_hash: Option<String>, // Optional SHA-256 hash for verification
) -> Result<String, String> {
    // Security: Enforce HTTPS-only URLs
    if !url.starts_with("https://") {
        return Err(
            "Only HTTPS URLs are allowed for security. The URL must start with https://"
                .to_string(),
        );
    }

    // Security: Block private/internal network addresses (IPv4)
    let url_parsed = url::Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;
    let host = url_parsed.host_str().unwrap_or("");

    // Check IPv4 private ranges
    if host.starts_with("10.")
        || (host.starts_with("172.")
            && host.len() > 4
            && host[4..].starts_with(|c: char| ('1'..='9').contains(&c)))
        || host.starts_with("192.168.")
        || host == "localhost"
        || host == "127.0.0.1"
        || host.starts_with("0.")
    {
        return Err("Downloads from local/private network addresses are not allowed".to_string());
    }

    // Security: Block IPv6 private/unique local addresses (fc00::/7)
    if host.starts_with("fc") || host.starts_with("fd") || host == "::1" {
        return Err("Downloads from IPv6 private addresses are not allowed".to_string());
    }

    // Block IPv6 loopback and link-local
    if host == "[::1]" || host.starts_with("fe80:") {
        return Err(
            "Downloads from IPv6 loopback/link-local addresses are not allowed".to_string(),
        );
    }

    // Security: Validate filename — block all shell-special characters
    let dangerous_chars = [
        '&', '|', ';', '<', '>', '`', '$', '%', '^', '!', '\n', '\r', '"', '\'', '\\', '/',
    ];
    if filename.chars().any(|c| dangerous_chars.contains(&c)) {
        return Err("Invalid filename: contains prohibited characters".to_string());
    }

    // Security: Validate file extension
    let lower_filename = filename.to_lowercase();
    if !ALLOWED_EXTENSIONS
        .iter()
        .any(|ext| lower_filename.ends_with(ext))
    {
        return Err(format!(
            "Invalid file extension. Allowed: {}",
            ALLOWED_EXTENSIONS.join(", ")
        ));
    }

    // Security: Use a unique temp file to prevent TOCTOU/symlink attacks
    let unique_id = format!(
        "winget_install_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(unique_id).join(&filename);

    // Create the unique subdirectory
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .connect_timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let res = client
        .get(&url)
        .header("User-Agent", "WingetInterfaceApp")
        .send()
        .await
        .map_err(|e| format!("Failed to send download request: {}", e))?;

    // Security: Check response status
    if !res.status().is_success() {
        return Err(format!(
            "Download failed with HTTP status: {}",
            res.status()
        ));
    }

    let total_size = res.content_length().unwrap_or(0);

    // Security: Enforce maximum download size
    if total_size > MAX_DOWNLOAD_SIZE {
        return Err(format!(
            "Download too large: {:.1} MB (max {:.0} GB)",
            total_size as f64 / 1024.0 / 1024.0,
            MAX_DOWNLOAD_SIZE as f64 / 1024.0 / 1024.0 / 1024.0
        ));
    }

    let mut file = std::fs::File::create(&file_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();

    emit_progress(
        &window,
        ProgressEvent {
            operation: "download".to_string(),
            package: filename.clone(),
            percent: 0,
            message: format!("Starting download: {}...", filename),
        },
    );

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| format!("Error while downloading: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Error while writing to file: {}", e))?;

        downloaded += chunk.len() as u64;

        // Security: Check size limit during download too
        if downloaded > MAX_DOWNLOAD_SIZE {
            // Clean up partial download
            let _ = std::fs::remove_file(&file_path);
            return Err("Download exceeded maximum allowed size".to_string());
        }

        if total_size > 0 {
            let percent = (downloaded as f64 / total_size as f64 * 100.0) as u8;
            if percent.is_multiple_of(5) {
                // Reduce event frequency
                emit_progress(
                    &window,
                    ProgressEvent {
                        operation: "download".to_string(),
                        package: filename.clone(),
                        percent,
                        message: format!(
                            "Downloading: {}% ({:.2} MB / {:.2} MB)",
                            percent,
                            downloaded as f64 / 1024.0 / 1024.0,
                            total_size as f64 / 1024.0 / 1024.0
                        ),
                    },
                );
            }
        }
    }

    emit_progress(
        &window,
        ProgressEvent {
            operation: "install".to_string(),
            package: filename.clone(),
            percent: 100,
            message: "Download complete. Verifying integrity...".to_string(),
        },
    );

    // Security: Verify file hash if provided
    if let Some(expected) = expected_hash {
        use sha2::{Digest, Sha256};

        let file_data = std::fs::read(&file_path).map_err(|e| {
            format!(
                "Failed to read downloaded file for hash verification: {}",
                e
            )
        })?;

        let mut hasher = Sha256::new();
        hasher.update(&file_data);
        let actual_hash = format!("{:x}", hasher.finalize());

        // Normalize both hashes to lowercase for comparison
        if actual_hash.to_lowercase() != expected.to_lowercase() {
            // Clean up the mismatched file
            let _ = std::fs::remove_file(&file_path);
            return Err(format!(
                "Hash verification failed! Expected: {}, Got: {}. File may be corrupted or tampered.",
                expected, actual_hash
            ));
        }

        emit_progress(
            &window,
            ProgressEvent {
                operation: "verify".to_string(),
                package: filename.clone(),
                percent: 100,
                message: "Hash verification successful".to_string(),
            },
        );
    }

    emit_progress(
        &window,
        ProgressEvent {
            operation: "install".to_string(),
            package: filename.clone(),
            percent: 100,
            message: format!("Launching installer: {}...", filename),
        },
    );

    // Execute the installer safely
    #[cfg(target_os = "windows")]
    {
        // Use ShellExecute via explorer.exe which is safer than cmd /C start
        let output = std::process::Command::new("explorer.exe")
            .arg(file_path.to_string_lossy().to_string())
            .spawn();

        // Security: Schedule temp file cleanup after installer launch
        // Note: We can't wait for installer completion (user may cancel),
        // but we can clean up the temp directory structure
        let temp_dir_to_clean = file_path.parent().map(|p| p.to_path_buf());
        if let Some(temp_dir) = temp_dir_to_clean {
            // Spawn a background task to cleanup after a delay
            std::thread::spawn(move || {
                // Wait 5 minutes for user to complete installation
                std::thread::sleep(std::time::Duration::from_secs(300));
                let _ = std::fs::remove_dir_all(&temp_dir);
            });
        }

        match output {
            Ok(_) => Ok(format!("Launched installer: {}", filename)),
            Err(e) => Err(format!("Failed to launch installer: {}", e)),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(format!(
            "Downloaded to {}, please run manually.",
            file_path.to_string_lossy()
        ))
    }
}
