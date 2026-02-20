Commit only iOS and shared changes from the working tree.

1. Run `git status` and `git diff` to review all changes
2. `git add` only files under:
   - `apps/ios-native/`
   - `packages/`
   - Root-level shared files (e.g. `package.json`, `tsconfig.json`, etc.)
3. For tracked-but-gitignored Info.plists, use: `git add -f apps/ios-native/ios/Nekt/Info.plist apps/ios-native/ios/NektClip/Info.plist` (if they have changes)
4. Do NOT add files under `apps/web/`
5. Auto-generate a concise commit message from the staged diff (summarize the "why", not the "what")
   - If the user provided a message in $ARGUMENTS, use it as-is instead
6. Commit with the message, appending:
   `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
7. Run `git status` to confirm

## Step 2: Local build (if needed)
- Check if any committed files are native iOS changes that cannot hot reload: Podfile, pbxproj, Info.plist, Swift/ObjC files (.swift, .m, .mm, .h), native module files under `native-modules/`
- If YES: boot iPhone Air simulator if not running (`xcrun simctl boot "iPhone Air"` + `open -a Simulator`), then run `cd apps/ios-native && npx expo run:ios` in background
- If NO (JS/TS-only changes): skip — Metro hot reload handles it

Do NOT push. Do NOT run any checks.
