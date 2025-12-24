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
