use serde::Serialize;
use tauri::{Emitter, Window};

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
