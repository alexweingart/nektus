Commit only the files you edited in this session. Do NOT commit other working tree changes.

1. Identify all files you modified or created in this conversation
2. Run `git status` and `git diff` to review changes
3. `git add` only those session files
4. Auto-generate a concise commit message from the diff (summarize the "why", not the "what")
   - If the user provided a message in $ARGUMENTS, use it as-is instead
5. Commit with the message, appending:
   `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
6. Run `git status` to confirm

## Step 2: Local build (if needed)
- Check if any committed files are native iOS changes that cannot hot reload: Podfile, pbxproj, Info.plist, Swift/ObjC files (.swift, .m, .mm, .h), native module files under `native-modules/`
- If YES: boot iPhone Air simulator if not running (`xcrun simctl boot "iPhone Air"` + `open -a Simulator`), then run `cd apps/ios-native && npx expo run:ios` in background
- If NO (JS/TS-only changes): skip — Metro hot reload handles it

Do NOT push. Do NOT run any checks.
