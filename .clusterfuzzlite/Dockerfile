# ClusterFuzzLite copies the checkout into the image (no git clone), so
# private repos work without credentials.
FROM gcr.io/oss-fuzz-base/base-builder-rust@sha256:433319ea1a6bbea6c1db1915a5d385021908cc62026d9f0efda2270ef6060de3

# The app's dependency graph pulls in Tauri's Linux sys crates (glib-sys,
# webkit2gtk-sys, ...), which need the system libraries at build time.
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libglib2.0-dev \
    libgtk-3-dev \
    libsoup-3.0-dev \
    libjavascriptcoregtk-4.1-dev \
    libwebkit2gtk-4.1-dev \
    libxdo-dev \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    build-essential \
    curl \
    file

COPY . $SRC/winget
COPY ./.clusterfuzzlite/build.sh $SRC/
WORKDIR $SRC/winget
