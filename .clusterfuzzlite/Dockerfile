# ClusterFuzzLite copies the checkout into the image (no git clone), so
# private repos work without credentials.
FROM gcr.io/oss-fuzz-base/base-builder-rust@sha256:433319ea1a6bbea6c1db1915a5d385021908cc62026d9f0efda2270ef6060de3
COPY . $SRC/winget
COPY ./.clusterfuzzlite/build.sh $SRC/
WORKDIR $SRC/winget
