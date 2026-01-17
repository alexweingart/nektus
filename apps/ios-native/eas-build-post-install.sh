#!/bin/bash
set -e

# EAS Build Post-Install Hook
# This script runs after npm/yarn install but before pod install
# It generates React Native codegen files which are required for New Architecture

echo "=========================================="
echo "EAS Build: Generating React Native Codegen"
echo "=========================================="

# Navigate to the monorepo root (EAS copies the whole repo)
cd ../..

echo "Current directory: $(pwd)"
echo "Looking for React Native codegen script..."

# Find the react-native codegen script (handle both Bun and regular node_modules)
if [ -d "node_modules/.bun" ]; then
    # Bun package manager structure
    RN_PATH=$(ls -d node_modules/.bun/react-native@*/node_modules/react-native 2>/dev/null | head -1)
else
    # Regular node_modules structure
    RN_PATH="node_modules/react-native"
fi

if [ -z "$RN_PATH" ] || [ ! -d "$RN_PATH" ]; then
    echo "Warning: Could not find react-native package. Trying direct path..."
    RN_PATH="node_modules/react-native"
fi

CODEGEN_SCRIPT="$RN_PATH/scripts/generate-codegen-artifacts.js"

if [ ! -f "$CODEGEN_SCRIPT" ]; then
    echo "Error: Codegen script not found at $CODEGEN_SCRIPT"
    echo "Listing node_modules/.bun if it exists:"
    ls node_modules/.bun 2>/dev/null || echo "No .bun directory"
    exit 1
fi

echo "Found codegen script at: $CODEGEN_SCRIPT"

# Generate codegen output to temp directory
OUTPUT_DIR="/tmp/codegen-output"
mkdir -p "$OUTPUT_DIR"

echo "Running codegen for apps/ios-native..."
node "$CODEGEN_SCRIPT" \
    --path apps/ios-native \
    --targetPlatform ios \
    --outputPath "$OUTPUT_DIR"

# Copy generated files to iOS project
echo "Copying generated codegen files..."
mkdir -p apps/ios-native/ios/build/generated/ios
cp -R "$OUTPUT_DIR/build/generated/ios/"* apps/ios-native/ios/build/generated/ios/

echo "Codegen files generated successfully!"
echo "Contents of ios/build/generated/ios/:"
ls -la apps/ios-native/ios/build/generated/ios/

# Return to ios-native directory
cd apps/ios-native

echo "=========================================="
echo "EAS Build: Codegen generation complete"
echo "=========================================="
