# Nektus Monorepo

A monorepo containing the Nekt web app and iOS mobile app with shared code.

## Project Structure

```
nektus/
├── apps/
│   ├── web/          # Next.js web app (existing)
│   └── ios-native/   # React Native/Expo iOS app (new)
├── packages/
│   ├── shared-types/     # TypeScript type definitions
│   ├── shared-utils/     # Platform-agnostic utilities
│   └── shared-services/  # Firebase and business logic services
├── turbo.json        # Turborepo configuration
├── pnpm-workspace.yaml
└── package.json
```

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Xcode (for iOS development)
- Apple Developer Account ($99/year)

### Installation

```bash
pnpm install
```

### Development

**Web App:**
```bash
pnpm dev:web
# or
cd apps/web && pnpm dev
```

**iOS App (Simulator):**
```bash
cd apps/ios-native && pnpm ios
```

### Building

**Build all packages:**
```bash
pnpm build
```

**Build web app only:**
```bash
pnpm build:web
```

## Deploying to TestFlight

### 1. Login to Expo
```bash
eas login
```

### 2. Configure EAS Project
```bash
cd apps/ios-native
eas init
```
This will create an EAS project and update `app.json` with your project ID.

### 3. Configure Apple Credentials
```bash
eas credentials
```
Follow the prompts to configure your Apple Developer credentials.

### 4. Update App Configuration
Edit `apps/ios-native/app.json`:
- Update `expo.owner` with your Expo username
- Verify `ios.bundleIdentifier` is correct

Edit `apps/ios-native/eas.json`:
- Update `submit.production.ios.appleId` with your Apple ID
- Update `submit.production.ios.ascAppId` with your App Store Connect app ID

### 5. Build for TestFlight
```bash
cd apps/ios-native
eas build --platform ios --profile preview
```

### 6. Submit to TestFlight
```bash
eas submit --platform ios
```

## Shared Packages

### @nektus/shared-types
TypeScript type definitions shared between web and mobile:
- `UserProfile` - User profile data structure
- `ContactEntry` - Contact field entries
- `ContactExchange*` - Contact exchange types

### @nektus/shared-utils
Platform-agnostic utility functions:
- `formatPhoneNumber()` - Phone number formatting
- `getHighResGoogleImage()` - Google image URL optimization
- `getFieldValue()` - Extract values from contact entries
- `generateSocialUrl()` - Generate social media URLs

### @nektus/shared-services
Business logic services (Firebase, etc.):
- Profile service (coming soon)
- Contact exchange service (coming soon)

## Next Steps (Phase 2)

1. **Authentication** - Implement Google Sign-In with Expo AuthSession
2. **Profile Management** - Migrate Firebase profile service
3. **Contact Exchange** - Implement motion detection with expo-sensors
4. **UI Components** - Build React Native equivalents

See `SPEC.md` for the full iOS feature roadmap.
