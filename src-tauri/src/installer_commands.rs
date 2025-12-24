use std::io::Write;
use futures_util::StreamExt;
use crate::progress::{emit_progress, ProgressEvent};

#[tauri::command]
pub async fn download_and_install_command(
    window: tauri::Window,
    url: String,
    filename: String
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let res = client.get(&url)
        .header("User-Agent", "WingetInterfaceApp")
        .send()
        .await
        .map_err(|e| format!("Failed to send download request: {}", e))?;

    let total_size = res.content_length().unwrap_or(0);
    
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(&filename);
    let mut file = std::fs::File::create(&file_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();

    emit_progress(&window, ProgressEvent {
        operation: "download".to_string(),
        package: filename.clone(),
        percent: 0,
        message: format!("Starting download: {}...", filename),
    });

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| format!("Error while downloading: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Error while writing to file: {}", e))?;
        
        downloaded += chunk.len() as u64;
        
        if total_size > 0 {
            let percent = (downloaded as f64 / total_size as f64 * 100.0) as u8;
            if percent % 5 == 0 { // Reduce event frequency
                emit_progress(&window, ProgressEvent {
                    operation: "download".to_string(),
                    package: filename.clone(),
                    percent,
                    message: format!("Downloading: {}% ({:.2} MB / {:.2} MB)", 
                        percent, 
                        downloaded as f64 / 1024.0 / 1024.0, 
                        total_size as f64 / 1024.0 / 1024.0),
                });
            }
        }
    }

    emit_progress(&window, ProgressEvent {
        operation: "install".to_string(),
        package: filename.clone(),
        percent: 100,
        message: format!("Download complete. Launching installer: {}...", filename),
    });

    // Execute the installer
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("cmd")
            .args(&["/C", "start", "", &file_path.to_string_lossy()])
            .spawn();
        
        match output {
            Ok(_) => Ok(format!("Launched installer: {}", filename)),
            Err(e) => Err(format!("Failed to launch installer: {}", e)),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // For other OS, try to open with default app (though this app targets Windows/Winget)
        Ok(format!("Downloaded to {}, please run manually.", file_path.to_string_lossy()))
    }
}
