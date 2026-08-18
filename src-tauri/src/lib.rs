//! WinGet System Manager backend library.
//!
//! The app is a Tauri **binary** crate; the modules below live in the lib
//! target so unit tests and the cargo-fuzz fuzz targets can import them as a
//! regular dependency. `main.rs` is a thin wrapper that wires the Tauri
//! commands and window.

pub mod errors;
pub mod git_commands;
pub mod installer_commands;
pub mod llama_cpp_commands;
pub mod package_managers;
pub mod progress;
pub mod secure_storage;
pub mod validation;
pub mod winget_commands;
