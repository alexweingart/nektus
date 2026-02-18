Commit ALL changes in the working tree.

1. Run `git status` and `git diff` to review all changes
2. `git add -A` to stage everything
   - For ios files: use `git add -f apps/ios-native/ios/Nekt/Info.plist apps/ios-native/ios/NektClip/Info.plist` if those files have changes (they're gitignored but tracked)
3. Auto-generate a concise commit message from the diff (summarize the "why", not the "what")
   - If the user provided a message in $ARGUMENTS, use it as-is instead
4. Commit with the message, appending:
   `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
5. Run `git status` to confirm

Do NOT push. Do NOT run any checks.
