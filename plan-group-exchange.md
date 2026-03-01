# Implementation Plan: Multi-Person Exchange & Groups

## Context

The current exchange flow is 1:1 only — Redis-backed, polling-based, with a single `ContactView` after match. This plan implements the spec at `/Users/alexanderweingart/Code/nektus/spec-group-exchange.md` to support N-way contact exchanges, groups, group scheduling, and contact syncing.

**Concurrent web + iOS** development. Server/API work lives in `apps/web/` already. For UI, we build web first then port to iOS (or build both concurrently where straightforward). Web uses Next.js 15 (App Router, React, Tailwind); iOS uses React Native (Expo SDK 54, Reanimated).

### Key Existing Files (Both Platforms)

| Component | Web | iOS |
|-----------|-----|-----|
| Exchange page | `apps/web/src/app/x/[token]/page.tsx` | `apps/ios-native/src/app/components/views/ContactView.tsx` |
| Profile view | `apps/web/.../views/ProfileView.tsx` | `apps/ios-native/.../views/ProfileView.tsx` |
| Contact info | `apps/web/.../modules/ContactInfo.tsx` | `apps/ios-native/.../modules/ContactInfo.tsx` |
| Profile info | `apps/web/.../modules/ProfileInfo.tsx` | `apps/ios-native/.../modules/ProfileInfo.tsx` |
| Item chip | `apps/web/.../modules/ItemChip.tsx` | `apps/ios-native/.../modules/ItemChip.tsx` |
| History view | `apps/web/.../views/HistoryView.tsx` | `apps/ios-native/.../views/HistoryView.tsx` |
| Smart schedule | `apps/web/.../views/SmartScheduleView.tsx` | `apps/ios-native/.../views/SmartScheduleView.tsx` |
| AI schedule | `apps/web/.../views/AIScheduleView.tsx` | `apps/ios-native/.../views/AIScheduleView.tsx` |
| Dropdown | `apps/web/.../inputs/DropdownSelector.tsx` | `apps/ios-native/.../inputs/DropdownSelector.tsx` |
| Layout bg | `apps/web/.../layout/LayoutBackground.tsx` | `apps/ios-native/.../layout/LayoutBackground.tsx` |
| Profile context | `apps/web/src/app/context/ProfileContext.tsx` | `apps/ios-native/src/app/context/ProfileContext.tsx` |
| Contact save | `apps/web/src/client/contacts/save.ts` | `apps/ios-native/src/client/contacts/save.ts` |
| Firebase CRUD | `apps/web/src/client/profile/firebase-save.ts` | `apps/ios-native/src/client/firebase/firebase-save.ts` |

---

## Phase 0: Shared Foundation (Types + Reusable Components)

No behavior changes. Build types and UI primitives that later phases depend on.

### 0A. Shared Types

**`packages/shared-types/src/contactExchange.ts`** — Add:
- `ExchangeSessionParticipant`: `{ userId?, status: 'pending_auth'|'joined', sharingCategory?, joinedAt, joinMethod: 'initiator'|'qr-scan'|'ble', scannedAt? }`
- `ExchangeSession`: `{ token, createdBy, status: 'active'|'concluded'|'expired', participants[], createdAt, concludedAt?, expiresAt }`
- `Group`: `{ groupId, shortCode, name?, memberUserIds[], createdBy, exchangeSessionToken?, createdAt, updatedAt }`
- `ScheduleSession`: `{ scheduleCode, type: 'individual'|'group', groupId?, contactUserId?, participantUserIds[], messages[], extractedConstraints[], lastMessageAt, expiresAt, createdAt }`
- Extend `SavedContact`: add optional `sources: string[]`, `phoneNumbers?: string[]`, `emails?: string[]`, `company?: string`, `title?: string`, `lastSyncedAt?: number`
- Clean up dead types: remove `MotionDetectionResult` (motion detection deleted), `ContactExchangeMessage`, `GoogleContactsResult`

**`packages/shared-types/src/profile.ts`** — Add:
- `AvailabilityPill` type: `{ available: number; total: number }`
- Extend `SchedulingParams` with optional `contactUserIds: string[]` for N-way

### 0B. ProfileContext Extensions (both platforms)

**Web: `apps/web/src/app/context/ProfileContext.tsx`**
**iOS: `apps/ios-native/src/app/context/ProfileContext.tsx`**

Both already use `onSnapshot` subscriptions for profile and contacts (with `contactsLoading`, `sharingCategory`, `getContacts()`). Extend with:
- Extended local `SavedContact` with `sources?`, `phoneNumbers?`, `emails?`, `company?`, `title?`
- `groups: Group[] | null`, `groupsLoading: boolean`
- `onSnapshot` subscription for `profiles/{userId}/groups` subcollection (follow existing contacts subscription pattern)
- `getGroup(groupId)` and `getGroups()` helpers

### 0C. New Reusable UI Components

Each component built for **web first**, then **iOS**.

**StackedHeads** — Overlapping circular avatars
- Web: `apps/web/src/app/components/ui/elements/StackedHeads.tsx` (NEW) — CSS negative margins, Tailwind
- iOS: `apps/ios-native/src/app/components/ui/elements/StackedHeads.tsx` (NEW) — negative `marginLeft` style
- Props: `participants[]` (userId, profileImage, name, backgroundColors), `size` (default 32), `maxVisible` (default 5), `onHeadTap?`
- Shows `+N` overflow indicator
- Reused by: ExchangeView, GroupView, GroupChip

**CondensedContactInfo** — Chip-style contact card for group views
- Web: `apps/web/src/app/components/ui/modules/CondensedContactInfo.tsx` (NEW)
- iOS: `apps/ios-native/src/app/components/ui/modules/CondensedContactInfo.tsx` (NEW)
- Props: `profile: UserProfile`, `onTap?`, `onRemove?`, `showRemoveButton?`
- Layout: small avatar (40px, same as ItemChip), name + subtitle (1 line), compact social icon row, optional trash icon
- Reuses existing `SocialIconsList` (may need `compact` prop or icon count cap). Note: phone entries now produce 2 icons (call + text), so cap may be needed sooner.
- Reused by: ExchangeView (2+ matches), GroupView

**GroupChip** — Group list item
- Web: `apps/web/src/app/components/ui/modules/GroupChip.tsx` (NEW)
- iOS: `apps/ios-native/src/app/components/ui/modules/GroupChip.tsx` (NEW)
- Props: `group: Group`, `members: SavedContact[]`, `onTap?`, `onScheduleTap?`
- Like ItemChip but left = `CompositeAvatar`, title = member names, right CTA = calendar icon
- Reused by: ConnectionsView

**CompositeAvatar** — Single circle with member photos split into sections
- Web: `apps/web/src/app/components/ui/elements/CompositeAvatar.tsx` (NEW)
- iOS: `apps/ios-native/src/app/components/ui/elements/CompositeAvatar.tsx` (NEW)
- Props: `members[]` (profileImage, name), `size` (default 40)
- Layouts (based on number of *other* members, excluding you):
  - 1 other (2 total): single full avatar of the other person (same as normal ItemChip)
  - 2 others (3 total): 50/50 vertical split
  - 3 others (4 total): 50/25/25 — one person gets left half, two split right half top/bottom
  - 4+ others (5+ total): quadrants (2x2 grid), shows first 4
- Clipped to a circle, thin divider lines between sections
- Reused by: GroupChip

### 0D. QR Code Extraction

**Web: `apps/web/src/app/components/ui/elements/QRCodeDisplay.tsx`** (NEW)
**iOS: `apps/ios-native/src/app/components/ui/elements/QRCodeDisplay.tsx`** (NEW)
- Extract QR rendering from `ProfileInfo.tsx` into standalone component
- Props: `token: string`, `avatarSrc?: string`, `size?: number`
- Reused by: ExchangeView + ProfileInfo

### 0E. Shortcode Utility

**`apps/web/src/server/profile/firebase-admin.ts`** — Export `generateShortCode()` and `generateAndReserveShortCode()` (currently private). Reused for group/schedule shortcodes.

---

## Phase 1: Exchange Session Model (Backend)

Replace Redis-based session storage with Firestore `exchangeSessions`. Keep Redis for BLE matching coordination only. All work in `apps/web/`. Note: motion/bump detection has been removed — exchange is now BLE peripheral advertising + QR only.

### 1A. Exchange Session CRUD

**`apps/web/src/server/contacts/exchange-sessions.ts`** (NEW)
- `createSession(userId, sharingCategory, joinMethod)` → Firestore `exchangeSessions/{token}` doc
- `joinSession(token, userId, sharingCategory, joinMethod)` → add participant (max 10)
- `addPendingParticipant(token, scannedAt)` → `pending_auth` entry (no userId)
- `promoteParticipant(token, userId, sharingCategory)` → `pending_auth` → `joined`
- `getSession(token)` → read session doc
- `concludeForUser(token, userId)` → mark done; if last participant → `concluded`
- Uses Firebase Admin SDK

### 1B. API Route Changes

**`apps/web/src/app/api/exchange/initiate/route.ts`** (MODIFY)
- Add: create Firestore session via `createSession()`. Dual-write to Redis for backwards compat.

**`apps/web/src/app/api/exchange/pair/[token]/route.ts`** (MODIFY)
- Read Firestore session. If caller not a participant + session active + <10, join. Return `{ session, profiles }` (all participant profiles).

**`apps/web/src/app/api/exchange/preview/[token]/route.ts`** (MODIFY)
- Read Firestore session. Add `pending_auth` participant. Return preview for all participants.

**`apps/web/src/app/api/exchange/status/[sessionId]/route.ts`** (MODIFY)
- Check Firestore first, Redis fallback.

**`apps/web/src/server/contacts/matching.ts`** (MODIFY — minimal)
- When BLE match confirmed via `storeExchangeMatch()`, also create Firestore session with 2 participants.

### 1C. Client Session Service

**Web: `apps/web/src/client/contacts/exchange/session-service.ts`** (NEW)
- Subscribe to `exchangeSessions/{token}` via Firestore `onSnapshot`
- `onParticipantJoined(callback)`, `concludeForSelf()`, `getParticipantProfiles()`
- Used by web ExchangeView

**iOS: `apps/ios-native/src/client/contacts/exchange/session-service.ts`** (NEW)
- Same service adapted for React Native Firebase client SDK
- Replaces polling — `HybridExchangeService` is now the only exchange service (legacy server-only path removed)

**iOS: `apps/ios-native/src/client/contacts/exchange/hybrid-service.ts`** (MODIFY)
- BLE match (via `BLEPeripheralModule` native module + GATT) registers both into Firestore session
- Note: `start()` takes 3 args now (no `motionPermissionGranted`)

---

## Phase 2: ExchangeView Screen

Largest new component. Replaces current 1:1 exchange flow. **Web first.**

### 2A. Web ExchangeView

**`apps/web/src/app/x/[token]/page.tsx`** (MODIFY — major rewrite)
Currently renders `ContactView` for single match. Rewrite to render new `ExchangeView`.

**`apps/web/src/app/components/views/ExchangeView.tsx`** (NEW)
State management:
- `session` (live via `onSnapshot` from session-service)
- `participantProfiles: Map<string, UserProfile>` (fetched per userId)
- `excludedUserIds: Set<string>` (trash exclusions)
- `isSaved`, `isSaving`, `showSuccessModal`

Layout states (spec Section 3.1):
- **State A (0 matches)**: Stays on ProfileView — pulsing QR/avatar, exchange button in waiting state (as today). No navigation to ExchangeView yet.
- **State B (1 match)**: Auto-navigates to ExchangeView. QR pinned at top, full `ContactInfo` slides in, "Save Contact" + "Nah, who this"
- **State C (2+ matches)**: QR pinned top, `StackedHeads`, scrollable `CondensedContactInfo` list (newest first), sticky "Save All Contacts (N)" + "Nah, who this", trash per card. B→C transition: animation from full to condensed.

Background color cycling (Section 3.5):
- CSS transitions cycling through `backgroundColors` of each participant
- 5s hold, 1s transition. Build on existing `contactColors` prop pattern in `LayoutBackground.tsx`, extending it to cycle through multiple participants' colors

Anon variant:
- Unauthenticated user at `/x/{token}`: show preview (names, avatars, blurred), sign-in gate, then join

**`apps/web/src/app/components/views/ProfileView.tsx`** (MODIFY)
- On exchange start: avatar animates (shrinks) into the center of the App Clip QR code (CSS transition on scale + position)
- On match: navigate to `/x/{token}` instead of rendering inline ContactView

### 2B. iOS ExchangeView

**`apps/ios-native/App.tsx`** (MODIFY)
- Add to `RootStackParamList`: `Exchange: { token: string }`, `Group: { groupCode: string }`, `GroupSmartSchedule`, `GroupAISchedule`
- Add `AISchedule` optional params: `groupCode?`, `scheduleCode?`
- Deep linking: `Exchange: 'x/:token'`
- Keep `Contact` screen for historical mode

**`apps/ios-native/src/app/components/views/ExchangeView.tsx`** (NEW)
- Same state machine as web but using Reanimated for animations
- State B/C with `withTiming` for QR translateY, `interpolateColor` for background cycling
- State A (0 matches) remains on ProfileView (as today)
- Reuses `QRCodeDisplay`, `ContactInfo`, `StackedHeads`, `CondensedContactInfo`
- Exchange animations should use `use-exchange-animations.ts` hook (renamed from `use-profile-animations.ts`)
- ExchangeButton uses data-driven `BUTTON_CONTENT` config table — extend with new group status entries rather than reverting to imperative logic

**`apps/ios-native/src/app/components/views/ProfileView.tsx`** (MODIFY)
- On exchange start: avatar animates (shrinks) into the center of the App Clip QR code (Reanimated `withTiming` on scale + position)
- On match: `navigation.navigate("Exchange", { token })`

### 2C. Post-Save Flow (both platforms)

**Saving** (per contact, all platforms):
- Firebase: save to `profiles/{userId}/contacts/{contactUserId}` (always, all platforms)
- **iOS app**: also save to native iOS Contacts via `expo-contacts`
- **iOS Safari (web)**: download `.vcf` vCard files (one per person, or combined multi-contact vCard)
- **Android (web)**: save to Google Contacts via People API (existing incremental auth flow, one `createContact` per person)
- If Google Contacts linked (any platform): also save via Google People API

**Single contact**:
- `saveContactFlow()` → success modal ("You and {name} are officially nekt'd!") → "Say hi 👋" (SMS) / "Nah, they'll text me"

**Multi contact (2+)**:
- `saveContactFlow()` per non-excluded contact in parallel → auto-create Group → success modal ("Contacts Saved!") → "Say hi 👋" (group SMS) / "Nah, they'll text me"

**After modal dismiss**:
- "Done" → Profile
- "When are we hanging out?" → SmartSchedule (single) or GroupSmartSchedule (group)

### 2D. Save Flow Changes

**Web: `apps/web/src/client/contacts/save.ts`** (MODIFY)
- Add `saveAllContacts(profiles[], token, excludedUserIds)` — saves each to Firebase, saves to Google Contacts if linked, downloads vCards on iOS Safari, creates group if 2+

**iOS: `apps/ios-native/src/client/contacts/save.ts`** (MODIFY)
- Same `saveAllContacts()` — saves each to Firebase + native iOS Contacts, saves to Google Contacts if linked, creates group if 2+

---

## Phase 3: Connections Page + Groups

### 3A. History → Connections Rename + Filters

**Web: `apps/web/src/app/components/views/HistoryView.tsx`** → rename to **`ConnectionsView.tsx`**
- Add 3 `DropdownSelector` components: View (All/Groups/Contacts), Type (All/Personal/Work), Sort (Date Added/Alphabetical)
- Filter/sort on combined contacts + groups list
- Update routing/navigation references

**iOS: `apps/ios-native/src/app/components/views/HistoryView.tsx`** → rename to **`ConnectionsView.tsx`**
- Same 3 dropdowns using existing `DropdownSelector`
- Update `App.tsx`: rename History → Connections

### 3B. Group CRUD API

**`apps/web/src/app/api/groups/route.ts`** (NEW)
- POST: create group (memberUserIds, name?). Generate shortCode via `generateAndReserveShortCode()`. Write `groups/{groupId}` + `profiles/{userId}/groups/{groupId}` per member.
- GET: list groups for authenticated user

**`apps/web/src/app/api/groups/[groupCode]/route.ts`** (NEW)
- GET: fetch group by shortCode, resolve member profiles
- PATCH: rename
- DELETE: delete

### 3C. Inline Add Mode (both platforms)

In `ConnectionsView`:
- `+` button → header animates into search bar
- View forced to "Contacts", dropdown disabled
- Tap contact → checkmark + pin to top. Tap again → deselect.
- Search filters by name, clears on selection
- "Create Group" (enabled at 2+) → name prompt → POST groups API → navigate to GroupView

### 3D. GroupView Screen

**Web: `apps/web/src/app/g/[groupCode]/page.tsx`** (NEW — Next.js route)
**Web: `apps/web/src/app/components/views/GroupView.tsx`** (NEW)
**iOS: `apps/ios-native/src/app/components/views/GroupView.tsx`** (NEW)

Both:
- `StackedHeads` at top, editable group name, `CondensedContactInfo` list (no trash), action CTAs
- "Schedule Group Meetup" → Group Smart Schedule
- "AI Schedule" → AI Schedule with groupCode
- Tap member → ContactView (historical)
- Deep link: `/g/{groupCode}`

**Web routes also needed:**
- `apps/web/src/app/g/[groupCode]/smart-schedule/page.tsx` (NEW)
- `apps/web/src/app/g/[groupCode]/ai-schedule/page.tsx` (NEW)

---

## Phase 4: Group Smart Scheduling

### 4A. N-Way Availability API

**`apps/web/src/app/api/scheduling/common-times/route.ts`** (MODIFY)
- Accept `contactUserIds: string[]` alongside existing `user1Id`/`user2Id`
- N-way: fetch busy times for all users, compute per-slot availability count
- Return slots with `availabilityCount` and `totalParticipants`
- Ranking: max availability → soonest day → midpoint of preferred hours
- Location: centroid of all participants' coordinates → Foursquare search

### 4B. Availability Pill Component

**Web: `apps/web/src/app/components/ui/elements/AvailabilityPill.tsx`** (NEW)
**iOS: `apps/ios-native/src/app/components/ui/elements/AvailabilityPill.tsx`** (NEW)
- Props: `available`, `total`
- Colors: green (100%), yellow (>50%), red (<=50%)
- Small rounded pill: "5/5"

### 4C. SmartScheduleView Updates (both platforms)

**Web: `apps/web/src/app/components/views/SmartScheduleView.tsx`** (MODIFY)
**iOS: `apps/ios-native/src/app/components/views/SmartScheduleView.tsx`** (MODIFY)
- Accept `groupCode` param. When present: fetch group, pass `contactUserIds[]` to API
- Add `AvailabilityPill` to each suggestion chip
- Event creation includes all member emails as attendees

---

## Phase 5: Group AI Scheduling

### 5A. Multi-Person Chat UI (both platforms)

**Web: `apps/web/src/app/components/views/AIScheduleView.tsx`** (MODIFY)
**iOS: `apps/ios-native/src/app/components/views/AIScheduleView.tsx`** (MODIFY)
- Accept `groupCode` and `scheduleCode` params
- Group mode: avatar + name above each message bubble, left-align others, Nektbot with brand color
- Nektbot greeting adjusts for groups

### 5B. Schedule Session API

**`apps/web/src/app/api/scheduling/sessions/route.ts`** (NEW) — POST create session
**`apps/web/src/app/api/scheduling/sessions/[scheduleCode]/route.ts`** (NEW) — GET session, POST message

**`apps/web/src/app/api/scheduling/ai/route.ts`** (MODIFY)
- Accept groupCode/scheduleCode. Multi-person constraint tracking.
- Fetch all participant calendars for availability

### 5C. Shareable URL Route + Share Button

**Web route: `apps/web/src/app/s/[scheduleCode]/page.tsx`** (NEW)
- Renders AIScheduleView in join mode. Expired → error message.

Share button (both platforms):
- Top-right header of AIScheduleView
- Generates `/s/{scheduleCode}` on first share
- Clipboard + toast (web) / native share sheet (iOS)

---

## Phase 6: Contact Syncing

### 6A. Google Contacts Sync (Server)

**`apps/web/src/app/api/contacts/google/sync/route.ts`** (NEW)
- People API `people.connections.list` using existing OAuth token
- `syncToken` for delta sync
- Normalize and return contacts

### 6B. Phone Contacts Sync (iOS only)

**`apps/ios-native/src/client/contacts/sync/phone-sync.ts`** (NEW)
- `expo-contacts` to read device address book
- Normalize phone (E.164), emails (lowercase)
- Permission handling

### 6C. Client Merge & Dedup (both platforms)

**Web: `apps/web/src/client/contacts/sync/contact-merger.ts`** (NEW)
**iOS: `apps/ios-native/src/client/contacts/sync/contact-merger.ts`** (NEW)
- Merge Google + phone contacts (match on normalized phone OR email)
- Dedup against existing Nektus contacts
- Set `sources` array

### 6D. Sync Orchestrator (both platforms)

**Web: `apps/web/src/client/contacts/sync/sync-service.ts`** (NEW)
**iOS: `apps/ios-native/src/client/contacts/sync/sync-service.ts`** (NEW)
- Trigger: app launch + Profile page view, 1-hour TTL
- Fetch Google (+ phone on iOS) in parallel, merge, store to `profiles/{userId}/contacts/{contactId}`
- Non-blocking background execution

### 6E. Display in ConnectionsView (both platforms)

- Synced-only contacts: source icon badge on avatar
- Tap → simplified contact view (no full Nektus profile)
- Appear in "Contacts" filter only

---

## Migration Strategy

### Redis → Firestore (Phase 1)
1. **Dual-write**: initiate writes to both Redis AND Firestore
2. **Dual-read**: status endpoint checks Firestore first, Redis fallback
3. **Client cutover**: ExchangeView uses `onSnapshot` only
4. **Redis cleanup**: after all clients ship, remove Redis session storage (keep for BLE coordination)

### SavedContact `sources` field
- Backfill script: set `sources: ['nektus']` on existing contacts
- Until migration: treat `undefined` sources as `['nektus']` in client code

---

## Phase Dependencies

```
Phase 0 (Foundation) ──┬──> Phase 1 (Session Model) ──> Phase 2 (ExchangeView)
                       │                                       │
                       └──> Phase 3 (Connections + Groups) ────┤
                                      │                        │
                                      ├──> Phase 4 (Group Smart Sched)
                                      └──> Phase 5 (Group AI Sched)

                            Phase 6 (Contact Syncing) — independent, needs Phase 0 + 3
```

Phases 4, 5, and 6 are independent of each other.

---

## Verification Plan

### Phase 0
- `npm run build` compiles with no errors in `packages/shared-types`
- `vitest` passes for shared-types
- New UI components render correctly (web: `npm run dev`, iOS: `bun run ios`)

### Phase 1
- `/api/exchange/initiate` → Firestore doc created (check Firebase console)
- `/api/exchange/pair/{token}` → participant added, all profiles returned
- BLE match → Firestore session with 2 participants
- `onSnapshot` fires on web/iOS when new participant joins
- Unit tests via vitest for session CRUD functions

### Phase 2
- Start exchange → ProfileView shows pulsing QR + waiting state (as today)
- Second device scans QR → State B (contact card appears)
- Third joins → State C (stacked heads + condensed cards)
- "Save All Contacts" → saved to Firebase + platform contacts, group created
- Background colors cycle through participants

### Phase 3
- Connections page shows contacts + groups interleaved
- Dropdown filters work (View, Type, Sort)
- Add Mode: select 2+ → create group → GroupView
- GroupView: members listed, tap → ContactView

### Phase 4
- Group SmartSchedule fetches N-way availability
- Pills show correct colors/fractions
- Ranked by availability → soonest → midpoint

### Phase 5
- Group AI chat: avatars + names per message
- Share → `/s/` URL generated, opens join mode
- Expired link → error message

### Phase 6
- Google contacts synced and shown with badge
- Phone contacts (iOS) imported and merged
- Dedup: matching phone/email merges into existing contact
- 1-hour TTL respected
