Commit only web and shared changes from the working tree.

1. Run `git status` and `git diff` to review all changes
2. `git add` only files under:
   - `apps/web/`
   - `packages/`
   - Root-level shared files (e.g. `package.json`, `tsconfig.json`, etc.)
3. Do NOT add files under `apps/ios-native/`
4. Auto-generate a concise commit message from the staged diff (summarize the "why", not the "what")
   - If the user provided a message in $ARGUMENTS, use it as-is instead
5. Commit with the message, appending:
   `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
6. Run `git status` to confirm

Do NOT push. Do NOT run any checks.
