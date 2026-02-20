Commit web + shared changes, then push with web checks.

Arguments: $ARGUMENTS
Parse for an optional commit message (in quotes). Web pushes don't have build targets — no iOS build.

## Step 1: Commit (web + shared scope)
1. Run `git status` and `git diff` to review all changes
2. `git add` only files under:
   - `apps/web/`
   - `packages/`
   - Root-level shared files (e.g. `package.json`, `tsconfig.json`, etc.)
3. Do NOT add files under `apps/ios-native/`
4. Auto-generate a concise commit message from the staged diff (summarize the "why", not the "what")
   - If the user provided a quoted message, use it as-is instead
5. Commit with the message, appending:
   `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

## Step 2: Pre-push checks (web only)
1. `cd apps/web && bun run typecheck` — abort on failure
2. `cd apps/web && bun run lint` — abort on failure
3. `cd apps/web && bun run build` — abort on failure

## Step 3: Push
- `git push --no-verify`
- If no upstream, use `git push -u origin HEAD --no-verify`

Done. No iOS build.

## Error handling
- If checks fail, abort — do not push
