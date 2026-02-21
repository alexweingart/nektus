# iOS Migration Plan: Web App to iOS Native

## Overview

This document outlines the complete migration plan from `apps/web` to `apps/ios-native` and `packages/shared-client`. The goal is to achieve feature parity with web while keeping code DRY through shared-client.

---

## PART 1: Complete Planned File Tree for `apps/ios-native/src/app`

### Legend
- `[DONE]` - Already exists and complete
- `[DONE-NEEDS-UPDATE]` - Exists but needs minor updates
- `[COPY EXACT]` - Copy directly from web with only import path changes
- `[COPY+MODIFY]` - Copy from web, requires platform adaptations
- `[NEW]` - Write from scratch (iOS-specific)

```
apps/ios-native/src/app/
├── components/
│   ├── ui/
│   │   ├── buttons/
│   │   │   ├── Button.tsx                    [DONE-NEEDS-UPDATE] - add font-semibold (fontWeight: "600") for xl size
│   │   │   ├── SecondaryButton.tsx           [DONE]
│   │   │   ├── ExchangeButton.tsx            [DONE] - needs enhancement for bump detection
│   │   │   └── ContactButton.tsx             [COPY+MODIFY] from web/components/ui/buttons/ContactButton.tsx
│   │   │
│   │   ├── controls/
│   │   │   ├── DualStateSelector.tsx         [DONE]
│   │   │   ├── ProfileViewSelector.tsx       [DONE]
│   │   │   └── ToggleSetting.tsx             [COPY+MODIFY] from web/components/ui/controls/ToggleSetting.tsx
│   │   │
│   │   ├── elements/
│   │   │   ├── Avatar.tsx                    [DONE]
│   │   │   ├── NektLogo.tsx                  [DONE]
│   │   │   ├── SocialIcon.tsx                [DONE]
│   │   │   ├── SocialIconsList.tsx           [DONE]
│   │   │   ├── LoadingSpinner.tsx            [COPY+MODIFY] from web/components/ui/elements/LoadingSpinner.tsx
│   │   │   ├── ProfileField.tsx              [COPY+MODIFY] from web/components/ui/elements/ProfileField.tsx
│   │   │   └── ProfileImageIcon.tsx          [COPY+MODIFY] from web/components/ui/elements/ProfileImageIcon.tsx
│   │   │
│   │   ├── icons/
│   │   │   └── EyeIcon.tsx                   [COPY+MODIFY] from web/components/ui/icons/EyeIcon.tsx
│   │   │
│   │   ├── inputs/
│   │   │   ├── Input.tsx                     [DONE]
│   │   │   ├── DropdownPhoneInput.tsx        [COPY+MODIFY] from web/components/ui/inputs/DropdownPhoneInput.tsx
│   │   │   ├── ExpandingInput.tsx            [COPY+MODIFY] from web/components/ui/inputs/ExpandingInput.tsx
│   │   │   ├── ValidatedInput.tsx            [COPY+MODIFY] from web/components/ui/inputs/ValidatedInput.tsx
│   │   │   └── CustomSocialInputAdd.tsx      [COPY+MODIFY] from web/components/ui/inputs/CustomSocialInputAdd.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── LayoutBackground.tsx          [DONE]
│   │   │   ├── ParticleNetworkLite.tsx       [DONE]
│   │   │   ├── PullToRefresh.tsx             [DONE]
│   │   │   ├── FieldList.tsx                 [COPY+MODIFY] from web/components/ui/layout/FieldList.tsx
│   │   │   ├── FieldSection.tsx              [COPY+MODIFY] from web/components/ui/layout/FieldSection.tsx
│   │   │   └── PageHeader.tsx                [COPY+MODIFY] from web/components/ui/layout/PageHeader.tsx
│   │   │
│   │   ├── modals/
│   │   │   ├── StandardModal.tsx             [COPY+MODIFY] from web/components/ui/modals/StandardModal.tsx
│   │   │   ├── AddCalendarModal.tsx          [COPY+MODIFY] from web/components/ui/modals/AddCalendarModal.tsx (Phase 2)
│   │   │   ├── AddLocationModal.tsx          [COPY+MODIFY] from web/components/ui/modals/AddLocationModal.tsx (Phase 2)
│   │   │   └── AppleCalendarSetupModal.tsx   [COPY+MODIFY] from web/components/ui/modals/AppleCalendarSetupModal.tsx (Phase 2)
│   │   │
│   │   ├── modules/
│   │   │   ├── ProfileInfo.tsx               [DONE] - needs QR code support enhancement
│   │   │   ├── ContactInfo.tsx               [COPY+MODIFY] from web/components/ui/modules/ContactInfo.tsx
│   │   │   ├── ItemChip.tsx                  [COPY+MODIFY] from web/components/ui/modules/ItemChip.tsx
│   │   │   └── InlineAddLink.tsx             [COPY+MODIFY] from web/components/ui/modules/InlineAddLink.tsx
│   │   │
│   │   └── Typography.tsx                    [DONE]
│   │
│   └── views/
│       ├── HomePage.tsx                      [DONE]
│       ├── ProfileView.tsx                   [DONE] - needs major enhancement (animations, exchange flow)
│       ├── ProfileSetupView.tsx              [DONE] - needs social links adding UI
│       ├── SplashScreen.tsx                  [DONE]
│       ├── PrivacyView.tsx                   [DONE]
│       ├── TermsView.tsx                     [DONE]
│       ├── EditProfileView.tsx               [COPY+MODIFY] from web/components/views/EditProfileView.tsx
│       ├── ContactView.tsx                   [COPY+MODIFY] from web/components/views/ContactView.tsx
│       ├── HistoryView.tsx                   [COPY+MODIFY] from web/components/views/HistoryView.tsx
│       ├── SelectedSections.tsx              [COPY+MODIFY] from web/components/views/SelectedSections.tsx
│       ├── CalendarView.tsx                  [COPY+MODIFY] from web/components/views/CalendarView.tsx (Phase 2)
│       ├── LocationView.tsx                  [COPY+MODIFY] from web/components/views/LocationView.tsx (Phase 2)
│       ├── SmartScheduleView.tsx             [COPY+MODIFY] from web/components/views/SmartScheduleView.tsx (Phase 2)
│       └── AIScheduleView.tsx                [COPY+MODIFY] from web/components/views/AIScheduleView.tsx (Phase 3)
│
├── context/
│   └── ProfileContext.tsx                    [DONE] - needs streaming states, contacts cache enhancement
│
└── providers/
    └── SessionProvider.tsx                   [DONE]

---

## PART 2: Complete Planned File Tree for `apps/ios-native/src/client`

```
apps/ios-native/src/client/
├── auth/
│   ├── firebase.ts                           [DONE]
│   ├── google.ts                             [DONE]
│   ├── google-incremental.ts                 [NEW] - iOS OAuth re-auth for calendar scopes (uses expo-auth-session)
│   └── index.ts                              [DONE]
│
├── firebase/
│   ├── firebase-save.ts                      [DONE]
│   ├── firebase-storage.ts                   [DONE]
│   ├── index.ts                              [DONE]
│   └── init.ts                               [DONE]
│
├── profile/
│   ├── asset-generation.ts                   [DONE]
│   ├── save-helpers.ts                       [DONE]
│   └── filtering.ts                          [COPY+MODIFY] from web/client/profile/filtering.ts
│
├── contacts/
│   ├── exchange/
│   │   ├── service.ts                        [COPY+MODIFY] from web/client/contacts/exchange/service.ts
│   │   └── state.ts                          [COPY+MODIFY] from web/client/contacts/exchange/state.ts
│   ├── motion.ts                             [NEW] - iOS-specific using expo-sensors
│   ├── messaging.ts                          [COPY+MODIFY] from web/client/contacts/messaging.ts
│   └── save.ts                               [COPY+MODIFY] from web/client/contacts/save.ts
│
├── calendar/
│   └── providers/
│       ├── google.ts                         [COPY+MODIFY] from web/client/calendar/providers/google.ts (Phase 2)
│       ├── microsoft.ts                      [COPY+MODIFY] from web/client/calendar/providers/microsoft.ts (Phase 2)
│       ├── apple.ts                          [COPY+MODIFY] from web/client/calendar/providers/apple.ts (Phase 2)
│       └── tokens.ts                         [COPY+MODIFY] from web/client/calendar/providers/tokens.ts (Phase 2)
│
└── hooks/
    ├── use-contact-exchange-state.ts         [COPY+MODIFY] from web/client/hooks/use-contact-exchange-state.ts
    │                                         - Replace localStorage → AsyncStorage
    ├── use-edit-profile-fields.ts            [COPY+MODIFY] from web/client/hooks/use-edit-profile-fields.ts
    │                                         - Remove drag-drop logic initially
    ├── use-exchange-qr-display.ts            [COPY+MODIFY] from web/lib/hooks/use-exchange-qr-display.ts
    │                                         - QR camera needs expo-camera
    ├── use-contact-back-navigation.ts        [COPY+MODIFY] from web/client/hooks/use-contact-back-navigation.ts
    │                                         - Replace sessionStorage → AsyncStorage, adapt navigation
    ├── use-calendar-location-management.ts   [COPY+MODIFY] from web/client/hooks/use-calendar-location-management.ts (Phase 2)
    │                                         - Replace useRouter/useSearchParams → React Navigation
    ├── use-drag-and-drop.ts                  [NEW] - iOS-specific using react-native-draggable-flatlist (Phase 2)
    │                                         - Web version is DOM-based, iOS needs native approach
    ├── use-scheduling-pre-fetch.ts           [COPY+MODIFY] from web/client/hooks/use-scheduling-pre-fetch.ts (Phase 2)
    │                                         - Minor fetch() adaptation
    └── use-streaming-ai.ts                   [COPY+MODIFY] from web/client/hooks/use-streaming-ai.ts (Phase 3)
                                              - SSE streaming works in RN, minor window.open → Linking
```

---

## PART 3: Complete Planned File Tree for `packages/shared-client/src`

### Current State
```
packages/shared-client/src/
├── config/
│   └── firebase.ts                           [DONE]
├── profile/
│   ├── index.ts                              [DONE]
│   ├── avatar.ts                             [DONE]
│   ├── google-image.ts                       [DONE]
│   ├── image.ts                              [DONE]
│   ├── phone-formatter.ts                    [DONE]
│   ├── save.ts                               [DONE]
│   ├── transforms.ts                         [DONE]
│   └── utils.ts                              [DONE]
├── constants.ts                              [DONE]
├── index.ts                                  [DONE]
└── platform-detection.ts                     [DONE]
```

### Planned Additions
```
packages/shared-client/src/
├── contacts/
│   ├── url-utils.ts                          [MOVE] from web/client/contacts/url-utils.ts (pure functions)
│   ├── vcard.ts                              [MOVE] from web/client/contacts/vcard.ts (pure functions)
│   └── index.ts                              [NEW] - exports
│
└── index.ts                                  [UPDATE] - add exports for contacts/*
```

**Note**: url-utils and vcard go ONLY in shared-client (not duplicated in iOS).
Web will import from `@nektus/shared-client` after migration. No changes to web right now.

---

## PART 3.5: Complete Planned File Tree for `packages/shared-types/src`

### Current State (All DONE)
```
packages/shared-types/src/
├── index.ts                                  [DONE]
├── profile.ts                                [DONE]
├── ai-scheduling.ts                          [DONE]
├── places.ts                                 [DONE]
└── contactExchange.ts                        [DONE]
```

### Needed Updates
```
packages/shared-types/src/
├── profile.ts                                [UPDATE] - Add TimeSlot interface (used by calendar providers)
│
│   Add:
│   export interface TimeSlot {
│     start: string;  // ISO datetime
│     end: string;    // ISO datetime
│   }
│
├── contactExchange.ts                        [UPDATE] - Sync QR code feature types from web
│
│   Update ExchangeStatus to add:
│   | 'qr-scan-pending'   // QR scanned, User B signing in
│   | 'qr-scan-matched'   // QR scan completed, ready to view
│
│   Update ContactExchangeState to add:
│   qrToken?: string;  // Token from QR scan match
│
└── index.ts                                  [DONE] - already exports all
```

---

## PART 4: File-by-File Migration Details

### Priority 1: Core Contact Exchange (CRITICAL)

| Web Source | iOS Target | Action | Changes Required |
|------------|------------|--------|------------------|
| `web/client/contacts/exchange/service.ts` | `ios/client/contacts/exchange/service.ts` | COPY+MODIFY | Replace window events with EventEmitter, adapt API calls |
| `web/client/contacts/exchange/state.ts` | `ios/client/contacts/exchange/state.ts` | COPY+MODIFY | Replace localStorage with AsyncStorage |
| `web/client/contacts/motion.ts` | `ios/client/contacts/motion.ts` | NEW | Use expo-sensors Accelerometer API instead of DeviceMotionEvent |
| `web/client/contacts/messaging.ts` | `ios/client/contacts/messaging.ts` | COPY+MODIFY | Replace window.open with Linking.openURL |
| `web/client/contacts/save.ts` | `ios/client/contacts/save.ts` | COPY+MODIFY | Use react-native-contacts instead of vCard blob |
| `web/client/contacts/url-utils.ts` | `shared-client/contacts/url-utils.ts` | MOVE | No changes (pure functions) |
| `web/client/contacts/vcard.ts` | `shared-client/contacts/vcard.ts` | MOVE | No changes (pure functions) |

### Priority 2: Views

| Web Source | iOS Target | Action | Key Changes |
|------------|------------|--------|-------------|
| `web/components/views/EditProfileView.tsx` | `ios/app/components/views/EditProfileView.tsx` | COPY+MODIFY | React Native components, no drag-drop (initially) |
| `web/components/views/ContactView.tsx` | `ios/app/components/views/ContactView.tsx` | COPY+MODIFY | React Native components, native contact saving |
| `web/components/views/HistoryView.tsx` | `ios/app/components/views/HistoryView.tsx` | COPY+MODIFY | FlatList instead of div, navigation |
| `web/components/views/SelectedSections.tsx` | `ios/app/components/views/SelectedSections.tsx` | COPY+MODIFY | React Native TouchableOpacity |

### Priority 3: UI Components

| Web Source | iOS Target | Action | Key Changes |
|------------|------------|--------|-------------|
| `web/components/ui/elements/LoadingSpinner.tsx` | `ios/app/components/ui/elements/LoadingSpinner.tsx` | COPY+MODIFY | Use ActivityIndicator |
| `web/components/ui/elements/ProfileField.tsx` | `ios/app/components/ui/elements/ProfileField.tsx` | COPY+MODIFY | React Native Text/View |
| `web/components/ui/modals/StandardModal.tsx` | `ios/app/components/ui/modals/StandardModal.tsx` | COPY+MODIFY | React Native Modal component |
| `web/components/ui/inputs/DropdownPhoneInput.tsx` | `ios/app/components/ui/inputs/DropdownPhoneInput.tsx` | COPY+MODIFY | Use react-native-phone-input or similar |
| `web/components/ui/inputs/ValidatedInput.tsx` | `ios/app/components/ui/inputs/ValidatedInput.tsx` | COPY+MODIFY | TextInput with validation |
| `web/components/ui/layout/FieldList.tsx` | `ios/app/components/ui/layout/FieldList.tsx` | COPY+MODIFY | ScrollView/FlatList |
| `web/components/ui/layout/PageHeader.tsx` | `ios/app/components/ui/layout/PageHeader.tsx` | COPY+MODIFY | Use react-navigation header or custom |
| `web/components/ui/modules/ContactInfo.tsx` | `ios/app/components/ui/modules/ContactInfo.tsx` | COPY+MODIFY | React Native components |
| `web/components/ui/modules/ItemChip.tsx` | `ios/app/components/ui/modules/ItemChip.tsx` | COPY+MODIFY | View/Text instead of div/span |
| `web/components/ui/controls/ToggleSetting.tsx` | `ios/app/components/ui/controls/ToggleSetting.tsx` | COPY+MODIFY | React Native Switch |

### Priority 4: Hooks

| Web Source | iOS Target | Action | Key Changes |
|------------|------------|--------|-------------|
| `web/client/hooks/use-contact-exchange-state.ts` | `ios/app/hooks/use-contact-exchange-state.ts` | COPY+MODIFY | AsyncStorage instead of localStorage |
| `web/client/hooks/use-edit-profile-fields.ts` | `ios/app/hooks/use-edit-profile-fields.ts` | COPY+MODIFY | Remove drag-drop, adapt form handling |
| `web/lib/hooks/use-exchange-qr-display.ts` | `ios/app/hooks/use-exchange-qr-display.ts` | COPY+MODIFY | Use expo-camera for QR scanning |

---

## PART 5: Modifications Needed to Existing Files

### shared-types (No changes needed)
The existing types in `packages/shared-types/src/` are sufficient:
- `profile.ts` - UserProfile, ContactEntry, etc. - all good
- `contactExchange.ts` - SavedContact, exchange types - all good
- `ai-scheduling.ts` - scheduling types - all good
- `places.ts` - place types - all good

### ProfileView.tsx (iOS) - Major Enhancement Needed

Current iOS `ProfileView.tsx` is ~163 lines (simplified).
Web `ProfileView.tsx` is ~441 lines (full featured).

**Add from web version:**
1. Animation state management (`animationPhase`, floating/wind-up/exiting/entering)
2. Exchange success modal (StandardModal for "new friend saved")
3. QR code display integration (`showQRCode`, `matchToken`)
4. Event listeners for bump/match events
5. PWA-equivalent install prompt (App Store link?)
6. Unconfirmed channels indicator (yellow dot on edit button)

**Keep iOS-specific:**
1. `PullToRefresh` wrapper (iOS has this, web doesn't)
2. React Navigation instead of Next.js routing
3. React Native SVG icons
4. StyleSheet instead of Tailwind classes

### ProfileContext.tsx (iOS) - Enhancement Needed

Current iOS `ProfileContext.tsx` is ~352 lines.
Web `ProfileContext.tsx` is ~516 lines.

**Add from web version:**
1. `streamingSocialContacts` state for immediate UI updates during generation
2. `streamingProfileImage` state for crossfade during generation
3. `isGoogleInitials` and `isCheckingGoogleImage` states
4. `isNavigatingFromSetup` and `setNavigatingFromSetup`
5. `invalidateContactsCache` method
6. WhatsApp generation from phone (`generateWhatsAppFromPhone`)
7. Session sync logic (adapted for iOS auth)

**Keep iOS-specific:**
1. `initializeFirebaseServices()` call
2. `AssetGenerationState` pattern (already well-designed)
3. `needsSetup` computed property
4. `refreshProfile` method

### ExchangeButton.tsx (iOS) - Enhancement Needed

**Add from web version:**
1. Motion detection integration (bump-to-exchange)
2. Exchange state management (initiating → waiting → matched)
3. QR code fallback display
4. Real-time polling for matches
5. Event dispatching for animation triggers

---

## PART 6: Files to Write From Scratch

### 1. `ios/client/contacts/motion.ts`
**Purpose**: iOS-specific motion detection using expo-sensors
**Reason**: Web uses DeviceMotionEvent API, iOS needs expo-sensors Accelerometer

```typescript
// Pseudo-structure
import { Accelerometer } from 'expo-sensors';

export class MotionDetector {
  private subscription: Subscription | null = null;
  private onBumpDetected: (data: BumpData) => void;

  start(): void { /* Subscribe to Accelerometer */ }
  stop(): void { /* Unsubscribe */ }
  // Implement same bump detection algorithm as web
}
```

### 2. `ios/client/auth/google-incremental.ts`
**Purpose**: iOS OAuth re-authorization for additional scopes (calendar)
**Reason**: Web uses redirect flow, iOS needs expo-auth-session

```typescript
// Pseudo-structure
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';

export async function requestCalendarScope(): Promise<{ success: boolean }> {
  // Request additional calendar scope via Google OAuth
}
```

### 3. `ios/client/hooks/use-drag-and-drop.ts` (Phase 2)
**Purpose**: Field reordering in edit profile
**Reason**: Web version is DOM-based, iOS needs `react-native-draggable-flatlist`

```typescript
// Pseudo-structure using react-native-draggable-flatlist
export function useDragAndDrop({ fields, onReorder }) {
  // Return render props for DraggableFlatList
}
```

---

## PART 7: Navigation / Routing (App.tsx Updates)

### Current State
`App.tsx` currently has these screens:
- `Home` - Unauthenticated landing
- `Privacy` - Privacy policy
- `Terms` - Terms of service
- `ProfileSetup` - Phone number setup
- `Profile` - Main profile view

### Needed Additions
Add these screens to `RootStackParamList` and `Stack.Navigator`:

```typescript
// Update RootStackParamList type
export type RootStackParamList = {
  // Existing
  Home: undefined;
  Privacy: undefined;
  Terms: undefined;
  ProfileSetup: undefined;
  Profile: undefined;

  // Phase 1 additions
  EditProfile: undefined;
  Contact: { userId: string; isHistoricalMode?: boolean };
  History: undefined;

  // Phase 2 additions
  Calendar: { section: 'personal' | 'work' };
  Location: { section: 'personal' | 'work' };
  SmartSchedule: { contactUserId: string };

  // Phase 3 additions
  AISchedule: { contactUserId: string };
};
```

### Navigation Structure
```
Authenticated Flow:
  Profile
  ├── → EditProfile (tap pencil icon)
  ├── → History (tap clock icon)
  │     └── → Contact (tap a saved contact)
  │           ├── → SmartSchedule (Phase 2)
  │           └── → AISchedule (Phase 3)
  └── → Contact (after exchange match)

EditProfile:
  ├── → Calendar (Phase 2)
  └── → Location (Phase 2)
```

### Stack Navigator Updates
```tsx
// In authenticated section of Stack.Navigator
<Stack.Screen name="Profile" component={ProfileView} />
<Stack.Screen name="EditProfile" component={EditProfileView} />
<Stack.Screen name="History" component={HistoryView} />
<Stack.Screen name="Contact" component={ContactView} />
<Stack.Screen name="Privacy" component={PrivacyView} />
<Stack.Screen name="Terms" component={TermsView} />

// Phase 2
<Stack.Screen name="Calendar" component={CalendarView} />
<Stack.Screen name="Location" component={LocationView} />
<Stack.Screen name="SmartSchedule" component={SmartScheduleView} />

// Phase 3
<Stack.Screen name="AISchedule" component={AIScheduleView} />
```

---

## PART 8: Migration Phases

### Phase 1: Core Features (Priority)
1. Contact Exchange (motion detection, matching, QR fallback)
2. Edit Profile (full field management)
3. Contact View (view exchanged contact)
4. History View (saved contacts list)
5. ProfileView enhancements (animations, modals)
6. ProfileContext enhancements (streaming states)

### Phase 2: Scheduling Features
1. Calendar integration (Google, Apple, Microsoft)
2. Location management
3. Smart scheduling
4. Calendar/Location modals

### Phase 3: AI Features
1. AI scheduling assistant
2. Streaming AI responses

---

## PART 9: Summary Statistics

### iOS App Files (`apps/ios-native/src/`)

| Category | Count |
|----------|-------|
| Files already done | 23 |
| Files done but need updates | 1 (Button.tsx - xl font-semibold) |
| Files to copy with modifications | 35 |
| Files to write from scratch | 3 (motion.ts, google-incremental.ts, use-drag-and-drop.ts) |
| **Total iOS files when complete** | **~62** |

### Shared Packages

| Category | Count |
|----------|-------|
| shared-client files to add | 3 (url-utils, vcard, contacts/index) |
| shared-types updates needed | 2 (TimeSlot in profile.ts, QR types in contactExchange.ts) |

### Major Enhancements Needed

| File | Status | Changes |
|------|--------|---------|
| `Button.tsx` | Minor | Add `fontWeight: "600"` for xl size |
| `ProfileView.tsx` | Major | Animations, exchange flow, QR, modals |
| `ProfileContext.tsx` | Medium | Streaming states, WhatsApp generation |
| `ExchangeButton.tsx` | Major | Motion detection, exchange logic |
| `App.tsx` | Medium | Add 7+ new screen routes |

---

## PART 10: Recommended Order of Implementation

### Prep Work
1. **Update shared-types/profile.ts**: Add `TimeSlot` interface
2. **Update shared-types/contactExchange.ts**: Sync QR types from web (ExchangeStatus + qrToken)
3. **Move to shared-client**: `url-utils.ts`, `vcard.ts` → create `contacts/` folder
4. **Update Button.tsx**: Add `fontWeight: "600"` for xl size

### Phase 1 Core (Contact Exchange)
5. **Create**: `ios/client/contacts/motion.ts` (expo-sensors)
6. **Copy+Modify**: `ios/client/contacts/exchange/service.ts`
7. **Copy+Modify**: `ios/client/contacts/exchange/state.ts`
8. **Copy+Modify**: `ios/client/hooks/use-contact-exchange-state.ts`
9. **Copy+Modify**: `ios/client/hooks/use-exchange-qr-display.ts`
10. **Enhance**: `ExchangeButton.tsx` with motion/exchange logic
11. **Enhance**: `ProfileView.tsx` with animations/exchange modals
12. **Enhance**: `ProfileContext.tsx` with streaming states

### Phase 1 Views
13. **Copy+Modify**: `StandardModal.tsx`
14. **Copy+Modify**: `EditProfileView.tsx`
15. **Copy+Modify**: `ios/client/hooks/use-edit-profile-fields.ts`
16. **Copy+Modify**: `ContactView.tsx`
17. **Copy+Modify**: `ios/client/hooks/use-contact-back-navigation.ts`
18. **Copy+Modify**: `HistoryView.tsx`
19. **Copy+Modify**: Supporting UI (ContactInfo, ItemChip, PageHeader, etc.)

### Navigation
20. **Update**: `App.tsx` with new routes (EditProfile, Contact, History)

---

## Appendix: Web Files NOT Needed for iOS

These web-specific files have no iOS equivalent:
- `api/*` routes - Backend, accessed via HTTP from iOS
- `middleware.ts` - Next.js specific
- `sitemap.ts` - SEO
- `error.tsx`, `not-found.tsx` - Next.js error boundaries
- `providers/AdminModeProvider.tsx` - Dev debugging
- `providers/SessionProvider.tsx` (web) - Uses NextAuth, iOS has own
- `debug/*` - Development tools
- `hooks/use-pwa-install.ts` - PWA specific
- `hooks/use-drag-and-drop.ts` - Can implement later with react-native-draggable-flatlist
- `client/auth/google-incremental.ts` - Web OAuth flow
- `client/calendar/providers/*` - Will need iOS-specific OAuth flows
- `client/cn.ts` - Tailwind utility, not needed
- All `server/*` files - Backend code
