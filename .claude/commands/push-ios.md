Push current branch with checks, scoped to iOS context.

Arguments: $ARGUMENTS
Parse the argument for a build target: `dev` (default if omitted), `preview`, or `prod`.

## Step 1: Pre-push checks

### Web checks (always run):
1. `cd apps/web && bun run typecheck` — abort on failure
2. `cd apps/web && bun run lint` — abort on failure
3. `cd apps/web && bun run build` — abort on failure

### iOS checks:
1. `cd apps/ios-native && npx tsc --noEmit` — abort on failure (if tsconfig exists)

## Step 2: Push
- `git push --no-verify` (we already ran checks explicitly)
- If no upstream, use `git push -u origin HEAD --no-verify`

## Step 3: iOS Build (based on target)

### If target is `dev`:
- Check if unpushed commits contain native-only iOS changes that cannot hot reload: Podfile, pbxproj, Info.plist, Swift/ObjC files (.swift, .m, .mm, .h), native module files
- If YES: boot iPhone Air simulator if not running, then run `npx expo run:ios` in background
- If NO: done

### If target is `preview`:
1. **Pre-flight**: Check `excludedPackages` in `apps/ios-native/app.json` match `ios/Podfile` (both `exclude` array and `clip_command`). Fix and update `Podfile.backup` if out of sync.
2. **Bump build number** in all 3 places: `apps/ios-native/app.json` (expo.ios.buildNumber), `apps/ios-native/ios/Nekt/Info.plist` (CFBundleVersion), `apps/ios-native/ios/NektClip/Info.plist` (CFBundleVersion). Increment by 1.
3. **Commit**: `git add apps/ios-native/app.json && git add -f apps/ios-native/ios/Nekt/Info.plist apps/ios-native/ios/NektClip/Info.plist` then commit `"Bump build number to <N>"`
4. **Push** the bump commit
5. **Build**: `cd apps/ios-native && eas build --platform ios --profile preview --local --non-interactive`

### If target is `prod`:
1. **Pre-flight**: Same as preview
2. **Bump build number**: Same as preview
3. **Commit + push**: Same as preview
4. **Build**: `cd apps/ios-native && eas build --platform ios --profile production --local --non-interactive`
5. **Submit**: On success, `eas submit --platform ios --path <ipa-path>` to TestFlight

## Error handling
- If `eas` fails due to TTY/stdin issues, print the exact command for the user to run in their terminal
- If Apple credential prompt appears, suggest setting `EXPO_APPLE_ID` and `EXPO_APPLE_APP_SPECIFIC_PASSWORD` env vars
- If checks fail, abort and report errors — do not push
