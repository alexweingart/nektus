Commit iOS + shared changes, then push with checks and optional iOS build.

Arguments: $ARGUMENTS
Parse for an optional commit message (in quotes) and/or a build target: `dev` (default), `preview`, or `prod`.
Examples: `/commit-push-ios`, `/commit-push-ios prod`, `/commit-push-ios "fix App Clip" preview`

## Step 1: Commit (iOS + shared scope)
1. Run `git status` and `git diff` to review all changes
2. `git add` only files under:
   - `apps/ios-native/`
   - `packages/`
   - Root-level shared files (e.g. `package.json`, `tsconfig.json`, etc.)
3. For tracked-but-gitignored Info.plists: `git add -f apps/ios-native/ios/Nekt/Info.plist apps/ios-native/ios/NektClip/Info.plist` (if they have changes)
4. Do NOT add files under `apps/web/`
5. Auto-generate a concise commit message from the staged diff (summarize the "why", not the "what")
   - If the user provided a quoted message, use it as-is instead
6. Commit with the message, appending:
   `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

## Step 2: Pre-push checks

### Web checks (always run):
1. `cd apps/web && npm run typecheck` — abort on failure
2. `cd apps/web && npm run lint` — abort on failure
3. `cd apps/web && npm run build` — abort on failure

### iOS checks:
1. `cd apps/ios-native && npx tsc --noEmit` — abort on failure (if tsconfig exists)

## Step 3: Push
- `git push --no-verify`
- If no upstream, use `git push -u origin HEAD --no-verify`

## Step 4: iOS Build (based on target)

### If target is `dev`:
- Check if the committed files contain native-only iOS changes that cannot hot reload: Podfile, pbxproj, Info.plist, Swift/ObjC files (.swift, .m, .mm, .h), native module files
- If YES: boot iPhone Air simulator if not running, then run `npx expo run:ios` in background
- If NO: done

### If target is `preview`:
1. **Pre-flight**: Check `excludedPackages` in `apps/ios-native/app.json` match `ios/Podfile` (both `exclude` array and `clip_command`). Fix and update `Podfile.backup` if out of sync.
2. **Bump build number** in all 3 places: `apps/ios-native/app.json` (expo.ios.buildNumber), `apps/ios-native/ios/Nekt/Info.plist` (CFBundleVersion), `apps/ios-native/ios/NektClip/Info.plist` (CFBundleVersion). Increment by 1.
3. **Commit**: `git add apps/ios-native/app.json && git add -f apps/ios-native/ios/Nekt/Info.plist apps/ios-native/ios/NektClip/Info.plist` then commit `"Bump build number to <N>"`
4. **Push** the bump commit
5. **Build**: `cd apps/ios-native && eas build --platform ios --profile preview --local --non-interactive`

### If target is `prod`:
1-3. Same as preview
4. **Push** the bump commit
5. **Build**: `cd apps/ios-native && eas build --platform ios --profile production --local --non-interactive`
6. **Submit**: On success, `eas submit --platform ios --path <ipa-path>` to TestFlight

## Error handling
- If `eas` fails due to TTY/stdin issues, print the exact command for the user to run in their terminal
- If Apple credential prompt appears, suggest setting `EXPO_APPLE_ID` and `EXPO_APPLE_APP_SPECIFIC_PASSWORD` env vars
- If checks fail, abort — do not push
