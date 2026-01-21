# App Clip Connect Flow - Implementation Plan

## Overview

Redesign the App Clip to show a contact view flow instead of onboarding. When someone scans a QR code on iOS, they see the contact preview, sign in with Apple, provide phone number, then can save the contact and text.

---

## URL & Routing (No Changes Needed)

**URL Format:** `https://nekt.us/connect?token=<exchangeToken>`

This is already the format used by QR codes. The `apple-app-site-association` file handles routing:
- **App Clip installed (no full app):** iOS shows App Clip card → opens App Clip
- **Full app installed:** Universal Links intercept → opens full app directly
- **Neither installed:** Opens web browser → shows web connect page

**Files already configured:**
- `apps/web/public/.well-known/apple-app-site-association` - routes to App Clip or full app
- `apps/ios-native/app.json` - associated domains for `nekt.us`

**No QR code modification needed** - existing QR codes will automatically trigger App Clip on iOS.

---

## Platform Capabilities Matrix

| Capability | App Clip | Full iOS App | Web (iOS) |
|------------|----------|--------------|-----------|
| Contacts access (CNContactStore) | **NO** | YES | NO |
| react-native-contacts | **NO** | YES | N/A |
| Me Card extraction | **NO** | YES | NO |
| vCard download/open | YES | YES (fallback) | YES |
| Firebase save | YES (via API) | YES (via API) | YES |
| Sign in with Apple | YES | YES | N/A (Google) |
| SKOverlay | YES | N/A | N/A |

---

## Phase 1: Cleanup - Delete Old Code

### 1.1 Delete iOS files
- [ ] Delete `apps/ios-native/src/app/components/views/AppClipOnboardingView.tsx`

### 1.2 Delete Web files
- [ ] Delete `apps/web/src/app/onboarding/` directory

### 1.3 Remove Google Contacts upsell from iOS app
- [ ] In `apps/ios-native/src/app/components/views/ContactView.tsx` - remove any Google Contacts upsell logic (if present)

### 1.4 Remove Google Contacts upsell from Web (iOS devices only)
- [ ] In `apps/web/src/app/components/views/ContactView.tsx` - skip Google Contacts upsell when `isIOS()` detected
- [ ] In `apps/web/src/client/contacts/save.ts` - modify `saveContactFlow()` to skip Google upsell on iOS

---

## Phase 2: Create AnonContactView for iOS

### 2.1 Port AnonContactView from web to iOS
Reference: `apps/web/src/app/components/views/AnonContactView.tsx`

Create: `apps/ios-native/src/app/components/views/AnonContactView.tsx`

**Features:**
- Display limited profile preview (name, bio, profile photo)
- Show masked/placeholder social icons (non-interactive, tap shows "sign in to view")
- "Sign in with Apple" button as primary CTA
- Store exchange token to persist through auth flow

### 2.2 Create preview API call for iOS
- [ ] Add client function to call `/api/exchange/preview/[token]` endpoint
- [ ] Handle the limited response (name, bio, socialIconTypes only)

---

## Phase 3: Implement App Clip Connect Flow

### 3.1 Rewrite AppClip.tsx entry point
File: `apps/ios-native/AppClip.tsx`

**New flow (matches web connect page):**
```
1. Parse exchange token from invocation URL: https://nekt.us/connect?token=xxx
2. If no token → show error state ("Invalid link")
3. If not authenticated → show AnonContactView (with token)
4. If authenticated → show ContactView (with token)
```

Note: No ProfileSetupView in connect flow (matches web behavior). Phone collection happens when user sets up their own profile to share, not when receiving a contact.

### 3.2 URL parsing for exchange token
- [ ] Use Expo Linking or React Native URL parsing to extract token
- [ ] Store token in React state (persists through auth flow since App Clip stays mounted)
- [ ] URL format: `https://nekt.us/connect?token=xxx`

### 3.3 Auth flow with token preservation
- [ ] Sign in with Apple (existing `signInWithApple()`)
- [ ] After auth success → show ContactView directly (no profile setup check)

---

## Phase 4: Implement Contact Saving in iOS

This phase covers BOTH the full app and App Clip, with different capabilities.

### 4.1 Full App Save Flow (with Contacts Permission)

File: `apps/ios-native/src/app/components/views/ContactView.tsx`

**On "Save to Contacts" tap:**
```
1. Check/request contacts permission (Contacts.requestPermissionsAsync())
   ├─ If GRANTED:
   │   a. Extract Me Card data (getMeCard(), getMeCardImage())
   │   b. Auto-fill user's profile if photo/phone empty
   │   c. Save contact via react-native-contacts
   │   d. Save to Firebase (background, /api/contacts)
   │   e. Show success modal
   │
   └─ If DENIED:
       a. Save to Firebase (background)
       b. Generate and open vCard (fallback)
       c. Show success modal
```

### 4.2 App Clip Save Flow (No Contacts Permission Available)

**On "Save to Contacts" tap:**
```
1. Save to Firebase (/api/contacts endpoint)
2. Generate vCard from contact data
3. Open vCard (iOS shows native "Add to Contacts" UI)
4. Show success modal
5. After "Done" → trigger SKOverlay
```

### 4.3 Implement Firebase save
- [ ] Call `/api/contacts` endpoint with exchange token
- [ ] Handle success/error responses
- [ ] Works in both App Clip and full app

### 4.4 Implement vCard generation for iOS
- [ ] Port vCard generation from web (`apps/web/src/client/contacts/vcard.ts`)
- [ ] Create vCard string from contact profile data
- [ ] Open vCard using `Linking.openURL('data:text/vcard,...')` or file share

### 4.5 Implement native contact save (full app only)
- [ ] Use `react-native-contacts` library (already in project)
- [ ] Map profile data to Contact object
- [ ] Call `Contacts.addContact(contact)`
- [ ] Handle errors gracefully

### 4.6 Implement Me Card extraction on permission grant (full app only)
Reference: `apps/ios-native/src/client/native/MeCardWrapper.ts` (already exists)

- [ ] After permission granted, call `getMeCard()` and `getMeCardImage()`
- [ ] If user's profile photo is empty/AI-generated → offer to use Me Card photo
- [ ] If user's phone is somehow empty → auto-fill from Me Card
- [ ] Save updates to user profile

### 4.7 Detect App Clip vs Full App context
- [ ] Create utility to detect if running in App Clip (check bundle ID or environment)
- [ ] Use this to branch between permission flow (full app) and vCard-only flow (App Clip)

---

## Phase 5: SKOverlay Integration (App Clip Only)

### 5.1 Trigger SKOverlay after save flow completes
File: `apps/ios-native/src/client/native/SKOverlayWrapper.ts` (exists)

- [ ] After user taps "Done" on success modal, call `showAppStoreOverlay()`
- [ ] Use position: `.bottom` (no tab bar in App Clip)
- [ ] Allow user dismissal

### 5.2 Verify SKOverlay works in App Clip context
- [ ] Test on real device
- [ ] Ensure overlay shows App Store listing correctly

---

## Phase 6: Full App - Universal Links for All URLs

When full app is installed, Universal Links route `nekt.us/*` to the app instead of browser/App Clip.

### 6.1 Implement Universal Link handler in full app
File: `apps/ios-native/App.tsx`

- [ ] Listen for incoming URLs via Expo Linking
- [ ] Parse URL path and query parameters
- [ ] Route to appropriate screen based on URL

### 6.2 URL routing map
| URL Pattern | iOS View | Notes |
|-------------|----------|-------|
| `/` | HomePage OR ProfileView | Based on auth state |
| `/connect?token=xxx` | ContactView | Receiving a contact (exchange flow) |
| `/setup` | ProfileSetupView | Profile setup |
| `/edit` | EditProfileView | Edit profile |
| `/edit/calendar` | CalendarView | Calendar settings |
| `/edit/location` | LocationView | Location settings |
| `/history` | HistoryView | Saved contacts list |
| `/contact/[userId]` | ContactView | View saved contact (historical mode) |
| `/contact/[userId]/smart-schedule` | SmartScheduleView | Smart schedule |
| `/contact/[userId]/ai-schedule` | AIScheduleView | AI schedule |
| `/privacy` | PrivacyView | Privacy policy |
| `/terms` | TermsView | Terms of service |
| `/about` | (may not exist in iOS) | About page |

### 6.3 Handle both cold start and warm start
- [ ] Cold start: URL passed via `Linking.getInitialURL()`
- [ ] Warm start: URL passed via `Linking.addEventListener('url', ...)`
- [ ] Ensure navigation works in both scenarios

### 6.4 Update apple-app-site-association (if needed)
File: `apps/web/public/.well-known/apple-app-site-association`

Current config already matches all paths (`"*"`), so no changes needed:
```json
{
  "applinks": {
    "details": [{
      "appIDs": ["V4R5CSCQ2J.com.nektus.app"],
      "components": [{ "/": "*" }]
    }]
  }
}
```

---

## Phase 7: Session Handoff (Preserve Existing)

### 7.1 Ensure session handoff still works
File: `apps/ios-native/src/client/auth/session-handoff.ts`

- [ ] After successful auth + setup in App Clip, store session for handoff
- [ ] When full app installed, retrieve session and auto-login
- [ ] User continues from authenticated state in full app

---

## File Changes Summary

### Files to DELETE:
```
apps/ios-native/src/app/components/views/AppClipOnboardingView.tsx
apps/web/src/app/onboarding/  (entire directory)
```

### Files to CREATE:
```
apps/ios-native/src/app/components/views/AnonContactView.tsx
apps/ios-native/src/client/contacts/vcard.ts  (port from web)
apps/ios-native/src/client/utils/app-clip-detect.ts
```

### Files to MODIFY:
```
apps/ios-native/AppClip.tsx                               # Complete rewrite
apps/ios-native/App.tsx                                   # Add Universal Links handling for all URLs
apps/ios-native/src/app/components/views/ContactView.tsx  # Implement save flow
apps/web/src/app/components/views/ContactView.tsx         # Skip Google upsell on iOS
apps/web/src/client/contacts/save.ts                      # Skip Google upsell on iOS
```

### Files to REFERENCE (already exist):
```
apps/ios-native/src/client/native/MeCardWrapper.ts        # Me Card extraction
apps/ios-native/src/client/native/SKOverlayWrapper.ts     # SKOverlay
apps/ios-native/src/client/auth/session-handoff.ts        # Session handoff
apps/web/src/app/components/views/AnonContactView.tsx     # Reference for iOS port
apps/web/src/client/contacts/vcard.ts                     # Reference for iOS port
```

---

## Implementation Order

1. **Phase 1** - Cleanup (delete old files, remove Google upsell)
2. **Phase 4.3-4.5** - Implement iOS ContactView saving (Firebase + vCard + native contacts)
3. **Phase 4.6** - Add Me Card extraction on permission grant
4. **Phase 2** - Create AnonContactView for iOS
5. **Phase 3** - Rewrite AppClip.tsx flow
6. **Phase 5** - SKOverlay integration
7. **Phase 6** - Universal Links for all URLs
8. **Phase 7** - Verify session handoff

This order allows testing ContactView saving independently before integrating into App Clip flow.

---

## Detailed Save Flow Diagrams

### App Clip Save Flow
```
User taps "Save to Contacts"
         │
         ▼
┌─────────────────────────┐
│  Save to Firebase       │  (POST /api/contacts)
│  (background)           │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Generate vCard         │
│  from contact data      │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Open vCard             │  (iOS native contact add UI)
│  Linking.openURL(...)   │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Success Modal          │
│  [Say Hi]  [Done]       │
└─────────────────────────┘
         │
         ▼ (on Done)
┌─────────────────────────┐
│  Show SKOverlay         │  (App Store install banner)
└─────────────────────────┘
```

### Full App Save Flow
```
User taps "Save to Contacts"
         │
         ▼
┌─────────────────────────┐
│  Request Contacts       │
│  Permission             │
└─────────────────────────┘
         │
    ┌────┴────┐
    │         │
 GRANTED   DENIED
    │         │
    ▼         ▼
┌───────┐  ┌───────────────┐
│Extract│  │ vCard         │
│Me Card│  │ Fallback      │
└───────┘  │ (same as      │
    │      │ App Clip)     │
    ▼      └───────────────┘
┌─────────────────────────┐
│  Auto-fill user profile │
│  if photo/phone empty   │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Save to Firebase       │  (background)
│  + react-native-contacts│  (foreground)
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Success Modal          │
│  [Say Hi]  [Done]       │
└─────────────────────────┘
```

---

## App Store Connect Setup (When Ready to Deploy)

- Create/update Default App Clip Experience
- URL prefix: `https://nekt.us/connect`
- Configure card metadata:
  - **Title:** "Save Contact" (30 char max)
  - **Subtitle:** "Tap to save this contact instantly" (56 char max)
  - **Action:** "Open"
  - **Header image:** Design needed (3000x2000px, no text)
