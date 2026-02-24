Commit session files, then push with checks.

Arguments: $ARGUMENTS
Parse for an optional commit message (in quotes) and/or a build target: `dev` (default), `preview`, or `prod`.
Examples: `/commit-push`, `/commit-push "fix padding"`, `/commit-push prod`, `/commit-push "fix padding" prod`

## Step 1: Commit (session files only)
1. Identify all files you modified or created in this conversation
2. Run `git status` and `git diff` to review changes
3. `git add` only those session files
4. Auto-generate a concise commit message from the diff (summarize the "why", not the "what")
   - If the user provided a quoted message, use it as-is instead
5. Commit with the message, appending:
   `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

## Step 2: Pre-push checks (only for affected platforms)

Determine which platforms are affected by files in unpushed commits:
- `apps/web/` → web is affected
- `apps/ios-native/` → iOS is affected
- `packages/` or root-level shared files → both platforms are affected

### Web checks (only if web or shared code changed):
1. `cd apps/web && bun run typecheck` — abort on failure
2. `cd apps/web && bun run lint` — abort on failure
3. `cd apps/web && bun run build` — abort on failure

### iOS checks (only if iOS or shared code changed):
1. `cd apps/ios-native && npx tsc --noEmit` — abort on failure (if tsconfig exists)

## Step 3: Push
- `git push --no-verify` (we already ran checks explicitly)
- If no upstream, use `git push -u origin HEAD --no-verify`

## Step 4: iOS Build (based on target)

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
1-3. Same as preview
4. **Push** the bump commit
5. **Build**: `cd apps/ios-native && eas build --platform ios --profile production --local --non-interactive`
6. **Submit**: On success, `eas submit --platform ios --path <ipa-path>` to TestFlight

## Error handling
- If `eas` fails due to TTY/stdin issues, print the exact command for the user to run in their terminal
- If checks fail, abort — do not push (but the commit is already made, which is fine)
