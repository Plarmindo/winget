//! Pure, dependency-light logic shared by the app and the cargo-fuzz
//! targets. No Tauri dependencies: the fuzz build stays slim and runs on
//! any base image.

pub mod errors;
pub mod parsing;
pub mod validation;
