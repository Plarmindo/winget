#!/bin/bash -eu
# Builds the cargo-fuzz targets with ClusterFuzzLite's libFuzzer toolchain and
# copies the binaries into $OUT. The base-builder-rust image ships nightly
# Rust and cargo-fuzz pre-installed.
cd $SRC/winget/src-tauri
cargo fuzz build -O --debug-assertions

# cargo-fuzz runs a plain `cargo build --manifest-path fuzz/Cargo.toml`, so the
# target dir depends on the layout: a standalone fuzz workspace puts binaries in
# fuzz/target, while a fuzz crate nested in a larger workspace (as here) shares
# the workspace root's target dir. Check both.
for f in fuzz/fuzz_targets/*.rs; do
  FUZZ_TARGET_NAME=$(basename "${f%.*}")
  found=""
  for dir in fuzz/target target; do
    if [ -f "$dir/x86_64-unknown-linux-gnu/release/$FUZZ_TARGET_NAME" ]; then
      cp "$dir/x86_64-unknown-linux-gnu/release/$FUZZ_TARGET_NAME" "$OUT/"
      found=1
      break
    fi
  done
  if [ -z "$found" ]; then
    echo "ERROR: built binary for $FUZZ_TARGET_NAME not found in fuzz/target or target" >&2
    ls -la fuzz/target/x86_64-unknown-linux-gnu/release/ 2>/dev/null || true
    ls -la target/x86_64-unknown-linux-gnu/release/ 2>/dev/null || true
    exit 1
  fi
done
