#![cfg_attr(fuzzing, no_main)]
//! Fuzzes `parse_winget_table`, which slices table rows by byte offsets found
//! in the header. Winget output is read with `String::from_utf8_lossy` in the
//! real code path, so arbitrary bytes are fed the same way here.
use winget_core::parsing::parse_winget_table;

fn run(data: &[u8]) {
    let input = String::from_utf8_lossy(data);
    let _ = parse_winget_table(&input);
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
