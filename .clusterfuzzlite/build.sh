#!/bin/bash -eu
# Builds the cargo-fuzz targets with ClusterFuzzLite's libFuzzer toolchain and
# copies the binaries into $OUT. The base-builder-rust image ships nightly
# Rust and cargo-fuzz pre-installed.
cd $SRC/winget/src-tauri
cargo fuzz build -O --debug-assertions
for f in fuzz/fuzz_targets/*.rs; do
  FUZZ_TARGET_NAME=$(basename "${f%.*}")
  cp "fuzz/target/x86_64-unknown-linux-gnu/release/$FUZZ_TARGET_NAME" "$OUT/"
done
