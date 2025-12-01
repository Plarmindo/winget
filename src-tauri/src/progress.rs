use tauri::{Window, Manager};
use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct ProgressEvent {
    pub operation: String,
    pub package: String,
    pub percent: u8,
    pub message: String,
}

pub fn emit_progress(window: &Window, event: ProgressEvent) {
    window.emit("operation-progress", event).ok();
}
