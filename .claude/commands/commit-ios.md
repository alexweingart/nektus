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

Do NOT push. Do NOT run any checks.
