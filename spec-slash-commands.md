# Slash Commands Spec

## Overview

Custom slash commands for Claude Code to automate commit, push, and build workflows across the nektus monorepo.

---

## Scopes

Every command has a **scope** that controls which files are affected:

| Suffix | Scope |
|--------|-------|
| *(none)* | Session files only (files Claude edited in this session) |
| `-all` | All modified/untracked files in the working tree |
| `-web` | All working tree changes in `apps/web/` + `packages/` + root-level shared files |
| `-ios` | All working tree changes in `apps/ios-native/` + `packages/` + root-level shared files |

All commands `git add` the relevant files — the user never needs to manually stage.

For `-ios` scope, use `git add -f` for `ios/Nekt/Info.plist` and `ios/NektClip/Info.plist` (gitignored but tracked).

---

## Build Targets

Commands that push accept an optional build target as the last argument. Default is `dev`.

| Target | Behavior |
|--------|----------|
| `dev` | No iOS build, UNLESS pushed changes include native-only changes that cannot hot reload (e.g. Podfile, pbxproj, Info.plist, Swift/ObjC files, native modules). If detected, launches iPhone Air simulator (if not already open) and runs `expo run:ios`. JS/TS changes never trigger a build — those hot reload. |
| `preview` | EAS preview build (internal/ad-hoc). Bumps build number, runs pre-flight checks. |
| `prod` | EAS production build + TestFlight submit. Bumps build number, runs pre-flight checks. |

---

## Commands

### `/commit [scope]`
Commit only — no push, no checks.

| Command | What it does |
|---------|-------------|
| `/commit` | Add + commit session files |
| `/commit-all` | Add + commit all working tree changes |
| `/commit-web` | Add + commit web + shared changes |
| `/commit-ios` | Add + commit ios + shared changes |

### `/push [scope] [target]`
Push only — no new commit. Runs checks, then pushes, then builds if applicable.

| Command | What it does |
|---------|-------------|
| `/push` | Push current branch (default: dev) |
| `/push prod` | Push + production build + TestFlight |
| `/push-ios preview` | Push + EAS preview build |

### `/commit-push [scope] [target]`
Commit + push + checks + build. The all-in-one command.

| Command | What it does |
|---------|-------------|
| `/commit-push` | Commit session files, push (dev) |
| `/commit-push-all` | Commit everything, push (dev) |
| `/commit-push-ios prod` | Commit ios + shared, push, production build + TestFlight |
| `/commit-push-web` | Commit web + shared, push (dev) |
| `/commit-push-all preview` | Commit everything, push, EAS preview build |

### Commit Message Behavior (all commands that commit)
- Auto-generate concise message from the staged diff
- User can optionally pass a message: `/commit-push "fix header padding"`
- If message provided, use it as-is
- Append `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

---

## Push Checks

All commands that push run these checks **before pushing**:

### Web checks (always run)
1. TypeScript check (`npm run typecheck` in `apps/web/`)
2. ESLint (`npm run lint` in `apps/web/`)
3. Full web build (`npm run build` in `apps/web/`)

### iOS checks (run if iOS files are in the push)
1. TypeScript check (`npx tsc --noEmit` in `apps/ios-native/`, if tsconfig exists)

> Note: The existing `pre-push` git hook runs web checks. The slash commands should either run checks themselves and skip the hook (`--no-verify`), or let the hook handle it. TBD — may want to run checks explicitly for better error reporting and skip the hook to avoid double-running.

---

## Build Pre-flight Checks (preview and prod targets)

Before starting any EAS build:
1. **excludedPackages sync**: Read `excludedPackages` from `app.json` and verify they match `ios/Podfile` (both the `exclude` array and `clip_command`). If out of sync, update the Podfile to match app.json.
2. **Podfile.backup sync**: If Podfile was changed (either by step 1 or prior edits), update `Podfile.backup` to match.
3. **Build number bump**: Read current build number, increment by 1, update all 3 locations:
   - `apps/ios-native/app.json` → `expo.ios.buildNumber`
   - `apps/ios-native/ios/Nekt/Info.plist` → `CFBundleVersion`
   - `apps/ios-native/ios/NektClip/Info.plist` → `CFBundleVersion`
4. **Auto-commit build number**: `git add` the 3 files, commit `"Bump build number to <N>"`

### Build Steps

**preview**:
- `eas build --platform ios --profile preview --local --non-interactive`

**prod**:
- `eas build --platform ios --profile production --local --non-interactive`
- On success: `eas submit --platform ios --path <ipa-path>`

---

## Error Handling

- If `eas` commands fail due to TTY/stdin issues, inform user to run the command in their own terminal and provide the exact command
- If Apple credential prompt appears, suggest setting `EXPO_APPLE_ID` and `EXPO_APPLE_APP_SPECIFIC_PASSWORD` environment variables
- If build fails with `fork: Resource temporarily unavailable`, suggest closing other apps and retrying
- If web checks (typecheck/lint/build) fail, abort the push and report the errors

---

## Implementation

These will be implemented as Claude Code custom slash commands (`.claude/commands/` directory), each as a markdown file with the prompt template.
