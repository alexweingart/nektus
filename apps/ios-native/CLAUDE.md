# Claude Code Guidelines - iOS Native App

## Build Performance Guidelines

### ALWAYS Use Incremental Builds
- **Default behavior**: `npm run ios` and `expo run:ios` use incremental builds automatically
- **Incremental builds**: 30 seconds - 2 minutes for small changes
- **Clean builds**: 10-15 minutes (only do when necessary)

### When to Clean Build
Only perform clean builds when:
- Switching branches with significant native dependency changes
- Pod dependencies are updated
- Experiencing unexplained build errors
- XCode cache corruption suspected

### When NOT to Clean Build
- Making code changes to TypeScript/JavaScript files
- Small native code modifications
- UI/component updates
- Most day-to-day development

### How to Avoid Accidental Clean Builds
- Don't run `npm run clean` unless necessary
- Avoid Xcode's "Clean Build Folder" (Cmd+Shift+K) during normal development
- Don't manually delete `ios/build` or DerivedData
- Let Xcode's incremental compiler do its job

## Project Characteristics

### Dependencies
- **~100 CocoaPods** - large dependency tree contributes to build time
- Heavy libraries:
  - React Native 0.81.5 + Hermes JS Engine + New Architecture (Fabric)
  - Firebase JS SDK (firebase ^11.0.0)
  - Expo SDK 54 + dev client
  - react-native-reanimated 4.x + react-native-worklets
  - react-native-screens 4.x, react-native-svg 15.12.1

### Configuration
- Uses Debug configuration by default (faster than Release)
- Optimization disabled for debug builds (correct for development)
- **New Architecture enabled** (Fabric + TurboModules)
- **Firebase JS SDK** (not native @react-native-firebase)
- ccache support available (check with `echo $USE_CCACHE`)

## Build Optimization Tips

1. **Use incremental builds** - the default, don't override
2. **Keep Xcode caches** - don't clean unless necessary
3. **Enable ccache** if not already:
   ```bash
   export USE_CCACHE=1
   ```
4. **Close other apps** during builds to free CPU/RAM
5. **Use Debug scheme** for development (already the default)
6. **Avoid rebuilding** when only JS changes are made - use hot reload

## Common Commands

```bash
# Standard incremental build (PREFERRED)
bun run ios
# or equivalently: npm run ios, expo run:ios

# Clean (only when necessary)
bun run clean

# EAS builds (uses their build servers)
bun run build:ios
```

## Notes for Claude Code
- Prefer incremental builds unless user explicitly requests clean build
- If suggesting rebuild, recommend incremental approach first
- Only suggest clean builds for dependency changes or build errors
- **Use subagents (Task tool) for running builds** to avoid polluting the main conversation context

---

# iOS Build Issue Writeup (January 2026)

## ✅ SOLVED - Working Configuration

**The iOS app now builds successfully with Expo SDK 54 + React Native 0.81.5 + New Architecture + App Clip.**

### Solution Summary
1. **Switched from `@react-native-firebase/*` to Firebase JS SDK (`firebase` ^11.0.0)**
   - This eliminates the need for `useFrameworks: static`
   - No native Firebase pods = no Swift bridging header issues

2. **Manual codegen generation** (required due to Bun package manager path issues)
   - React Native's codegen discovery doesn't work correctly with Bun's `.bun` symlink structure
   - Must generate codegen manually from repo root before pod install

### Current Environment
- **Expo SDK**: 54.0.31
- **React Native**: 0.81.5
- **Package Manager**: Bun 1.3.5
- **Firebase**: `firebase` ^11.0.0 (JS SDK, NOT @react-native-firebase)
- **Key Libraries**: react-native-screens 4.16.0, react-native-svg 15.12.1, react-native-reanimated 4.2.1, react-native-worklets 0.7.1

### Current app.json Configuration
```json
{
  "expo": {
    "newArchEnabled": true
  }
}
```
No `useFrameworks` setting needed with Firebase JS SDK.

---

## Build Instructions

### Incremental Builds (Day-to-Day Development)
For normal development after initial setup, just use:
```bash
bun run ios
# or equivalently: npm run ios, expo run:ios
```
No special steps needed - incremental builds work normally.

### Clean Builds (After prebuild --clean, branch switch, or deleting ios/build)

**Recommended: Use the automated script:**
```bash
cd apps/ios-native
./scripts/clean-prebuild.sh
```

This script:
1. Runs `expo prebuild --clean`
2. Restores the Podfile from `Podfile.backup` (contains all customizations)
3. Runs `pod install`

**Troubleshooting: If you get codegen header errors after running clean-prebuild.sh:**
```
'react/renderer/components/rnscreens/Props.h' file not found
```
Run pod install again - the first run generates the codegen, the second run properly configures the header search paths:
```bash
cd ios && pod install
```
Then build normally with `bun run ios`.

**Manual Alternative (if script fails):**

```bash
# 1. Run expo prebuild (if needed)
npx expo prebuild --clean

# 2. Restore Podfile customizations from backup
cp Podfile.backup ios/Podfile

# 3. Run pod install
cd ios && pod install
```

**If Podfile.backup is missing**, follow these manual steps:

```bash
# 1. Run expo prebuild (if needed)
npx expo prebuild --clean

# 2. Generate complete codegen from REPO ROOT (not ios-native dir)
cd /path/to/nektus  # Go to monorepo root
node node_modules/.bun/react-native@0.81.5+*/node_modules/react-native/scripts/generate-codegen-artifacts.js \
  --path apps/ios-native \
  --targetPlatform ios \
  --outputPath /tmp/codegen-output

# 3. Copy codegen to iOS project
cp -R /tmp/codegen-output/build/generated/ios/* apps/ios-native/ios/build/generated/ios/

# 4. Disable the codegen script phase (Bun path compatibility issue)
# Edit ios/build/generated/ios/ReactCodegen.podspec and replace the script_phases content with:
#   echo "[Codegen] Using pre-generated codegen files" > "${SCRIPT_OUTPUT_FILE_0}"
#   echo "Done." >> "${SCRIPT_OUTPUT_FILE_0}"

# 5. Run pod install with codegen skip flag
cd apps/ios-native/ios
RCT_SKIP_CODEGEN=1 pod install

# 6. Build
xcodebuild -workspace Nekt.xcworkspace -scheme Nekt -sdk iphonesimulator -configuration Debug build
# or just: npm run ios
```

### Why Manual Codegen is Required
- Bun creates paths like `node_modules/.bun/package@version+hash/node_modules/package`
- React Native's codegen discovery script fails to resolve these paths correctly during pod install
- The script only generates codegen for `react-native-safe-area-context`, missing RNSVG, RNScreens, etc.
- Running the codegen script from the monorepo root (where `require.resolve` works correctly) generates all libraries

---

## Historical Context - Previous Failed Approaches

### The Original Problem
With `@react-native-firebase/*`, we needed `useFrameworks: static` which broke codegen header visibility.

### Approaches That Failed
1. **useFrameworks: static + buildFromSource** - Codegen headers not visible to third-party pods
2. **useFrameworks: static + prebuilt RN** - Same header issues
3. **No useFrameworks + @react-native-firebase** - `FirebaseAuth-Swift.h` not found
4. **Old Architecture** - react-native-screens 4.x, reanimated 4.x require New Arch
5. **SDK 55 Canary** - Same fundamental issues

### The Winning Approach
**Firebase JS SDK** - Removes the need for `useFrameworks` entirely, allowing New Architecture to work with standard codegen.

---

## CRITICAL: Dependency Version Constraints

### react-native-svg Version
**MUST use version 15.12.1** - This is the version compatible with Expo SDK 54.

If you see the error `Tried to register two views with the same name RNSVGCircle`, it means there are multiple versions of react-native-svg being bundled. The fix is:

1. Ensure `react-native-svg` in package.json is exactly `15.12.1` (no caret)
2. Ensure root package.json has an override: `"overrides": { "react-native-svg": "15.12.1" }`
3. Clear bun cache and reinstall:
   ```bash
   rm -rf ~/.bun/install/cache
   rm -rf node_modules apps/*/node_modules packages/*/node_modules bun.lock
   bun install
   ```

**DO NOT** upgrade to 15.15.1 or other versions - they are not compatible with this Expo SDK version.

---

## EAS Local Production Builds (January 2026)

### Overview
EAS local builds (`eas build --local`) copy the project to a temp folder, which causes issues with Bun's package manager paths. The solution is custom Podfile hooks.

### Build Times
- **Clean EAS local build**: ~25-30 minutes
- **Includes**: prebuild, pod install, Xcode archive, signing, IPA export

### Critical Podfile Customizations

After running `expo prebuild --clean`, the Podfile is regenerated and loses customizations. **You MUST restore these**:

#### 1. Global Variables (after require statements at top)
```ruby
# Capture react-native path at parse time for use in pre_install hook
$react_native_path = File.dirname(`node --print "require.resolve('react-native/package.json')"`.strip)
$codegen_script_path = "#{$react_native_path}/scripts/generate-codegen-artifacts.js"
```

#### 2. Pre-install Hook (inside `target 'Nekt' do`, before post_install)
```ruby
pre_install do |installer|
  Pod::UI.puts "[Custom Codegen] Starting codegen generation..."
  codegen_script = $codegen_script_path
  ios_native_path = File.expand_path('..', Pod::Config.instance.installation_root)
  output_dir = '/tmp/codegen-output'

  if File.exist?(codegen_script)
    result = system("cd '#{ios_native_path}' && node '#{codegen_script}' --path . --targetPlatform ios --outputPath '#{output_dir}'")
    source_dir = "#{output_dir}/build/generated/ios"
    dest_dir = "#{ios_native_path}/ios/build/generated/ios"
    if File.exist?(source_dir)
      FileUtils.mkdir_p(dest_dir)
      FileUtils.cp_r("#{source_dir}/.", dest_dir)
    end
  end
end
```

#### 3. Extended Post-install Hook
Add to post_install after `react_native_post_install`:
- Header search path fixes for codegen
- Folly coroutines disable flag (`-DFOLLY_CFG_NO_COROUTINES=1`)
- Codegen xcconfig fixes for RNSVG, RNScreens, RNCAsyncStorage, RNWorklets, RNReanimated
- App Clip xcconfig fixes to remove excluded library linker flags

### Why This Is Needed
- EAS copies project to temp folder during build
- `require.resolve` at Podfile parse time works (paths resolve correctly)
- But during pre_install hook execution, the working directory context changes
- Solution: Capture paths at parse time into global variables, use them in hooks

---

## App Clip Size Limits

### iOS Version Limits
| iOS Version | Physical Invocation (NFC/QR) | Digital Invocation (Links/Messages) |
|-------------|------------------------------|-------------------------------------|
| iOS 15      | 10 MB                        | 10 MB                               |
| iOS 16      | 15 MB                        | 15 MB                               |
| iOS 17+     | 15 MB                        | **50-100 MB**                       |

### Configuration
To use the higher iOS 17+ limit, set in `app.json`:
```json
{
  "expo": {
    "ios": {
      "deploymentTarget": "17.0"
    }
  }
}
```

This sets `IPHONEOS_DEPLOYMENT_TARGET = 17.0` in the Xcode project.

### Current App Clip Size
- Main app IPA: ~22 MB
- App Clip is embedded within the IPA
- With iOS 17.0 deployment target, the 50MB+ limit applies

---

## Development Architecture Principle

**iOS-First Architecture Design**

When building new features or refactoring shared code:
- **iOS**: Build the architecture we want now (greenfield, get it right)
  - Use dependency injection patterns from shared-lib
  - Create platform-specific helpers in iOS-specific files
  - Keep business logic in shared-lib, implementation in platform files
- **Web**: Add TODOs for refactoring (production code, be careful)
  - Web currently has mixed shared + web-specific code
  - Will be refactored later to match iOS architecture
- **Shared-lib**: Only pure business logic, no platform-specific code
  - Use dependency injection for platform implementations
  - No React, NextAuth, or platform-specific types

**File Structure Pattern:**
- `packages/shared-lib/src/.../feature.ts` - Core business logic with dependency injection
- `apps/ios-native/src/lib/.../feature-helpers.ts` - iOS-specific helpers using shared service
- `apps/web/src/lib/.../feature.ts` - Web-specific + shared (temporary, will refactor to match iOS pattern)
