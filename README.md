# Nektus Monorepo

A monorepo containing the Nekt web app and iOS mobile app with shared code.

## Project Structure

```
nektus/
├── apps/
│   ├── web/              # Next.js web app
│   └── ios-native/       # React Native/Expo iOS app (+ App Clip)
├── packages/
│   ├── shared-types/     # TypeScript type definitions
│   └── shared-client/    # Shared business logic and services
├── turbo.json            # Turborepo configuration
└── package.json          # Bun workspaces
```

## Getting Started

### Prerequisites
- Node.js 18+
- [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`)
- Xcode (for iOS development)
- Apple Developer Account (for device builds / TestFlight)

### Installation

```bash
bun install
```

### Local Development

**Web App:**
```bash
bun run dev:web
# or
cd apps/web && bun run dev
```

**iOS App (Simulator):**
```bash
cd apps/ios-native && bun run ios
```

This runs `expo run:ios` which does an incremental build (30s–2min) and launches the simulator. For day-to-day TypeScript/JS changes, Metro hot reload handles it automatically — no rebuild needed. Only do a clean build (`./scripts/clean-prebuild.sh`) when switching branches with native dependency changes or after pod updates.

### Building Shared Packages

```bash
bun run build
```

## iOS Build Workflows (EAS)

### EAS Cloud Builds (Internal Testing)

The `preview` profile builds for internal/ad-hoc distribution:

```bash
cd apps/ios-native
eas build --platform ios --profile preview
```

This runs on EAS build servers and produces an IPA you can install on registered devices.

### Production Builds (TestFlight)

Production builds use the `production` profile with store distribution certs. Typically built locally with `--local` to use your machine and Apple credentials:

```bash
cd apps/ios-native
eas build --platform ios --profile production --local
```

Then submit to TestFlight:

```bash
eas submit --platform ios
```

### EAS Build Profiles Summary

| Profile       | Distribution | Use Case                        |
|---------------|-------------|----------------------------------|
| `development` | internal    | Dev client builds for simulator  |
| `preview`     | internal    | Ad-hoc builds for test devices   |
| `production`  | store       | TestFlight / App Store release   |

### First-Time EAS Setup

1. `eas login`
2. `cd apps/ios-native && eas init`
3. `eas credentials` — configure Apple Developer certs
4. Verify `apps/ios-native/app.json` has correct `expo.owner` and `ios.bundleIdentifier`
5. Verify `apps/ios-native/eas.json` has correct `appleId` and `ascAppId` under `submit.production.ios`

## Shared Packages

### @nektus/shared-types
TypeScript type definitions shared between web and mobile (profiles, contacts, exchanges, etc.).

### @nektus/shared-client
Shared business logic and services with dependency injection for platform-specific implementations (Firebase services, profile management, contact exchange logic).
