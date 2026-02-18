Commit only the files you edited in this session. Do NOT commit other working tree changes.

1. Identify all files you modified or created in this conversation
2. Run `git status` and `git diff` to review changes
3. `git add` only those session files
4. Auto-generate a concise commit message from the diff (summarize the "why", not the "what")
   - If the user provided a message in $ARGUMENTS, use it as-is instead
5. Commit with the message, appending:
   `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
6. Run `git status` to confirm

Do NOT push. Do NOT run any checks.
