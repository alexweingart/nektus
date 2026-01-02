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
- **267 CocoaPods** - large dependency tree contributes to build time
- Heavy libraries:
  - React Native + Hermes JS Engine
  - React Native Skia (graphics - slow to compile)
  - Firebase
  - Expo dev client
  - Worklets/Reanimated

### Configuration
- Uses Debug configuration by default (faster than Release)
- Optimization disabled for debug builds (correct for development)
- Uses `use_frameworks!` (dynamic frameworks)
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
npm run ios

# Clean (only when necessary)
npm run clean

# EAS builds (uses their build servers)
npm run build:ios
```

## Notes for Claude Code
- Prefer incremental builds unless user explicitly requests clean build
- If suggesting rebuild, recommend incremental approach first
- Only suggest clean builds for dependency changes or build errors

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
