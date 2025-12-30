# Nekt — iOS-first "meet → connect → book" flow

## Product Overview

Nekt iOS app transforms contact exchange into a native, frictionless experience using iOS-specific features like App Clips, Sign in with Apple, Contacts API, Bluetooth proximity, and lock screen widgets.

## 1) Entry & Progressive Install (iOS)

### Web → App Clip Launch
- User hits nekt.us and taps "Get Started"
- Automatically triggers the **App Clip**
- User enters App Clip immediately (no App Store visit required)

### Sign in with Apple (in App Clip)
- One-tap SIWA → get user's name (+ relay email if granted)
- Create/attach account with the name and email in Firebase
- **If possible**: Show SIWA slide up immediately when app clip loads (no user tap required)

### Progressive Onboarding UI
App Clip should make it clear there will only be 3 steps via product copy:
1. **Sign in with Apple** (current step highlighted/bold)
   - 1-2 line description: "Quick, secure sign-in with your Apple ID"
2. **Install Native App**
   - Description shown when current: "Get the full app for best experience"
3. **Enable Contact Sharing**
   - Description shown when current: "We need contacts to access your email, photo, and save new connections"

### Progressive Install Flow
- After sign in completes, page transitions to bolding step 2 (Installation)
- Automatically prompt **Install Full App** as part of onboarding
- **StoreKit overlay (SKOverlay.AppClipConfiguration)** pinned at the bottom
- Keep state so install resumes the flow

### Enable Contact Sharing
- After full app is installed, the app clip "refreshes" and 3rd step is highlighted (enable contact sharing)
- Immediately prompt users to enable with the iOS dialog
- After permission is granted, extract "**Me**" card via `CNContactStore.unifiedMeContact(...)`
- If present, prefill:
  - **Phone number(s)**
  - **Profile photo** (`imageData`)

### Phone # Fallback
- If unable to get phone number from Me card, show setup page as we have today

### Implementation Notes
- Use **Universal Links** so web/App Clip/full app handoffs are seamless
- Keep App Clip skinny, don't add more than what is needed there
- Minimum App Clip size for fast loading

## 2) Consent-Driven Contact Saving

### Use Contact Save API
- If user has opted in to contacts, when saving a contact after you have nekt'd:
  - Build a `CNMutableContact`
  - Wrap it in a `CNSaveRequest`
  - Execute it on a `CNContactStore`
  - No modal required; silent programmatic save triggered by user action (e.g., "Save to Contacts" button)

### Fallback for No Permission
- If user has not opted into contacts, fallback to existing vCard/vcf approach
- Continue to save to Firebase and maintain all other logic (Google Contacts, etc.) as today

### Data Flow
- All contact exchanges still save to Firebase (source of truth)
- iOS Contacts API is an additional save destination when permission granted
- vCard remains fallback for web/Android/no-permission cases

## 3) Bluetooth Proximity "Bump"

### Primary Exchange Method
- When users tap Nekt, leverage **Bluetooth proximity** as primary method
- Ask for Bluetooth permission first
- Works with:
  - iOS native app ↔ iOS native app
  - iOS native app ↔ Android web
  - Android web ↔ Android web

### Fallback to Motion Detection
- Keep fallback to motion detection if:
  - Bluetooth permission is denied
  - On iOS web (though won't be primary use case)
  - Bluetooth fails or times out

### Bluetooth Technology
- Start with **MultipeerConnectivity** (reliable local P2P over Bluetooth/Wi‑Fi)
- And/or **Nearby Interaction (U1/UWB)** for ultra-fast proximity on supported devices
- Set very tight distance boundary (as small as possible - nearly touching)

### Backend Integration
- Backend matching logic remains unchanged
- Bluetooth discovery triggers same hit/matching flow
- Geographic + temporal matching provides fallback validation

## 4) Lock Screen & Everyday Surfaces (iOS Focus)

### Lock Screen Widget (WidgetKit)
- Rectangular widget labeled e.g. "Nekt — Connect Now"
- On tap → open app to profile already in "Nekt" mode (waiting for bump)
- Provides quick access without unlocking phone and opening app

### Widget States
- Default: "Tap to Nekt"
- Active: "Waiting for connection..." (if app in background mid-exchange)
- Consider showing recent contact count or last connection

## 5) Implementation Cheat-Sheet (iOS)

### App Clip
- **Universal Link/NFC** → minimal views
- **ASAuthorizationAppleIDProvider** for SIWA
- Lightweight bundle (< 10MB target)

### Deep Links
- `UIApplication.open(_:options:)` for web → app clip → full app transitions
- Universal Links for seamless handoff

### Bluetooth Proximity
- **MultipeerConnectivity** (`MCNearbyServiceAdvertiser/Browser`) with a tiny JSON token
- Optional **NearbyInteraction** for UWB-capable devices later
- RSSI filtering for distance threshold

### Contact Save
- `CNMutableContact` → `CNSaveRequest` → execute on `CNContactStore`
- Fallback: `CNContactVCardSerialization` → `UIActivityViewController` or `CNContactViewController(forUnknownContact:)`
- Permission check before attempting save

### Widget
- **WidgetKit** rectangular widget
- Content = label + subtitle
- Tap → `Link` to deep link `/qr` or main exchange view
- Update widget state from app using `WidgetCenter.shared.reloadAllTimelines()`

## 6) Platform Strategy

### iOS Native App (Primary)
- Full native experience with all iOS-specific features
- Built with React Native + Swift for iOS-specific APIs
- App Clip for frictionless onboarding

### Web App (Fallback/Android)
- Continues to work for Android users
- Bluetooth support for Android ↔ Android and Android ↔ iOS
- Motion detection fallback for iOS Safari (edge case)

### Monorepo Structure
- Shared business logic, types, services
- Platform-specific implementations for UI, navigation, platform APIs
- Single codebase maintaining both platforms

## Success Metrics

### Technical
- App Clip load time < 2 seconds
- Bluetooth discovery time < 1 second
- Contact save success rate > 95%

### User Experience
- Sign-in to first Nekt < 30 seconds
- Progressive install completion rate > 70%
- Contact permission grant rate > 60%

## Future Considerations

- Android native app with similar features (using Android App Links, Google Sign-In)
- NFC tap-to-exchange as alternative to Bluetooth
- Widget complications for Apple Watch
- SharePlay for remote contact exchange
