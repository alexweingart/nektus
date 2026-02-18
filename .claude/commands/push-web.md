Push current branch with web checks only. No new commit — just push what's already committed.

This is a web-scoped push — only runs web checks, never triggers iOS builds regardless of target.

Arguments: $ARGUMENTS (ignored — web pushes are always dev-equivalent)

## Step 1: Pre-push checks (web only)
1. `cd apps/web && npm run typecheck` — abort on failure
2. `cd apps/web && npm run lint` — abort on failure
3. `cd apps/web && npm run build` — abort on failure

## Step 2: Push
- `git push --no-verify` (we already ran checks explicitly)
- If no upstream, use `git push -u origin HEAD --no-verify`

Done. No iOS build.
