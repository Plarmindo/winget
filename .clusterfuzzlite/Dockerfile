# ClusterFuzzLite copies the checkout into the image (no git clone), so
# private repos work without credentials.
FROM gcr.io/oss-fuzz-base/base-builder-rust
COPY . $SRC/winget
COPY ./.clusterfuzzlite/build.sh $SRC/
WORKDIR $SRC/winget
