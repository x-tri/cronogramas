#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$ROOT_DIR/.." && pwd)"
APP_NAME="XTRI Cronogramas"
PRODUCT_NAME="XTRICronogramasMac"
CONFIGURATION="${1:-debug}"

if [[ "$CONFIGURATION" != "debug" && "$CONFIGURATION" != "release" ]]; then
  echo "Uso: scripts/package-app.sh [debug|release]" >&2
  exit 1
fi

BUILD_FLAG=()
if [[ "$CONFIGURATION" == "release" ]]; then
  BUILD_FLAG=(--configuration release)
fi

BUILD_DIR="$ROOT_DIR/.build/arm64-apple-macosx/$CONFIGURATION"
DIST_DIR="$ROOT_DIR/dist"
APP_DIR="$DIST_DIR/$APP_NAME.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
ICON_FILE="AppIcon.icns"

cd "$ROOT_DIR"
swift build "${BUILD_FLAG[@]}"

rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

cp "$BUILD_DIR/$PRODUCT_NAME" "$MACOS_DIR/$PRODUCT_NAME"

if [[ -f "$ROOT_DIR/Resources/$ICON_FILE" ]]; then
  cp "$ROOT_DIR/Resources/$ICON_FILE" "$RESOURCES_DIR/$ICON_FILE"
fi

cat > "$CONTENTS_DIR/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>pt_BR</string>
  <key>CFBundleDisplayName</key>
  <string>$APP_NAME</string>
  <key>CFBundleExecutable</key>
  <string>$PRODUCT_NAME</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>online.xtri.cronogramas.mac</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.2.0</string>
  <key>CFBundleVersion</key>
  <string>2</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSSupportsAutomaticGraphicsSwitching</key>
  <true/>
</dict>
</plist>
PLIST

codesign --force --sign - "$APP_DIR" >/dev/null

echo "$APP_DIR"
