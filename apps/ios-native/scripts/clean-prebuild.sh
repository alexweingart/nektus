#!/bin/bash
# Clean prebuild script that restores customizations after expo prebuild
# Usage: ./scripts/clean-prebuild.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_NATIVE_DIR="$(dirname "$SCRIPT_DIR")"

echo "🧹 Running expo prebuild --clean..."
cd "$IOS_NATIVE_DIR"
npx expo prebuild --clean

echo "📋 Restoring Podfile customizations from backup..."
if [ -f "$IOS_NATIVE_DIR/Podfile.backup" ]; then
    cp "$IOS_NATIVE_DIR/Podfile.backup" "$IOS_NATIVE_DIR/ios/Podfile"
    echo "✅ Podfile restored from backup"
else
    echo "❌ Error: Podfile.backup not found!"
    echo "   You'll need to manually add the customizations from CLAUDE.md"
    exit 1
fi

echo "📦 Injecting custom native modules..."
node "$SCRIPT_DIR/inject-native-modules.js"

echo "📦 Injecting NektWidget target..."
node "$SCRIPT_DIR/inject-widget-target.js"

echo "📦 Running pod install..."
cd "$IOS_NATIVE_DIR/ios"
pod install

echo ""
echo "✅ Clean prebuild complete!"
echo "   You can now build with: bun run ios"
