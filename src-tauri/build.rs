fn main() {
    // Version single-source-of-truth guard: Cargo.toml's package version must
    // match package.json (the canonical version used by the frontend build and
    // tauri.conf.json's `version: "../package.json"`). Cargo cannot reference
    // JSON, so this assertion makes a drift a hard build error instead of a
    // silently mismatched installer version. Bump with `npm version` and then
    // `cargo` will complain if Cargo.toml was not updated to match.
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR");
    let pkg_json = std::path::Path::new(&manifest_dir).join("../package.json");
    let pkg_json_str = std::fs::read_to_string(&pkg_json).expect("failed to read ../package.json");
    let pkg_json: serde_json::Value =
        serde_json::from_str(&pkg_json_str).expect("failed to parse ../package.json");
    let expected = pkg_json
        .get("version")
        .and_then(serde_json::Value::as_str)
        .expect("package.json is missing a string `version` field");
    let actual = env!("CARGO_PKG_VERSION");
    assert_eq!(
        actual, expected,
        "version mismatch: Cargo.toml is {actual} but package.json is {expected}. \
         Update src-tauri/Cargo.toml to match (or run `npm version <new>` and sync)."
    );
    println!("cargo:rerun-if-changed=../package.json");

    tauri_build::build()
}
