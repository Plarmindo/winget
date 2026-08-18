//! Fuzzes the input validators that gate every winget operation. These run
//! user input through regexes and character checks before it reaches the
//! process boundary.
use winget_interface::validation::{validate_package_id, validate_search_query};

fn run(data: &[u8]) {
    let input = String::from_utf8_lossy(data);
    let _ = validate_package_id(&input);
    let _ = validate_search_query(&input);
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
