#![cfg_attr(fuzzing, no_main)]
//! Fuzzes the serde parser for `winget export` JSON files. The export is
//! parsed from disk bytes in `get_installed_package_ids`, so arbitrary bytes
//! are fed straight to serde_json.
use winget_core::parsing::WingetExport;

fn run(data: &[u8]) {
    let _ = serde_json::from_slice::<WingetExport>(data);
}

#[cfg(fuzzing)]
use libfuzzer_sys::fuzz_target;

#[cfg(fuzzing)]
fuzz_target!(|data: &[u8]| run(data));

// On stable the fuzz harness is not compiled; keep the bin buildable (and
// smoke-run the target on empty input) so CI compiles the fuzz targets.
#[cfg(not(fuzzing))]
fn main() {
    run(b"");
}
