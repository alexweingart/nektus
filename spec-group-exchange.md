# Multi-Person Exchange & Groups Spec

## 1. Overview

This spec covers the redesign of the exchange experience to support multiple people mutually exchanging contacts simultaneously, along with supporting features: group management, the Connections page (renamed from History), and multi-person scheduling.

### Goals
- Enable N-way contact exchanges (not just 1:1)
- Keep the App Clip QR code visible and scannable throughout the exchange
- Design a layout that works well for 1 person and scales to many
- Introduce a "Group" concept for contacts exchanged together
- Extend Smart Scheduling and AI Scheduling to support groups
- Maintain full web + iOS parity

### Non-Goals (for now)
- Push notifications
- Separate search UX on Connections page

---

## 2. Exchange Session Model

Today, exchanges are 1:1 with per-user tokens. We introduce **Exchange Sessions** — a shared, short-lived entity that multiple people can join. The existing `/x/{token}` route is reused; the token now represents a session rather than a single user.

### How It Works
1. **User A** taps "Nekt" (starts exchange) → creates an Exchange Session in Firestore, receives a token
2. A's QR/App Clip code encodes the same URL format as today: `https://nekt.us/x/{token}`
3. **User B** scans A's code (or connects via BLE) → joins the session
4. B's phone now also displays the **same session QR code** so others can scan B's phone too
5. **User C** can scan either A's or B's phone → joins the same session
6. All participants see each other's contact cards in real-time
7. Each participant independently decides who to save

### Session Lifecycle
- **Created**: When first user starts exchange
- **Active**: Accepting new participants via QR scan or BLE discovery. Remains active as long as at least one participant hasn't saved/dismissed yet.
- **Concluded**: When the last participant in the session saves or taps "Nah, who this" / "Never mind". No single person "closes" the session.
- **Expired**: Auto-cleanup after 1 hour of inactivity (TTL)

### Connection Methods & Multi-Person Behavior

| Method | Multi-person? | Behavior |
|--------|:---:|-----------|
| **QR / App Clip Code** | Yes | Anyone scans → joins session. Primary method for groups. |
| **BLE** | Yes | Keeps scanning until user exits. New BLE peers auto-join session. |
| **Bump** | 1:1 only | Timing-based, remains a two-phone interaction. Creates a session with 2 participants. |

### Group Size Limit
**Maximum 10 participants** per exchange session (inclusive of initiator). Aligns with Twilio's group messaging limit for future SMS integration. Enforced server-side when joining a session.

### QR on Everyone's Phone
**Yes** — once you join a session, your phone displays the session's QR code. This creates a network effect: in a group of 5, anyone walking up can scan any of their phones. The QR encodes the same token for all participants.

---

## 3. Exchange Page Redesign

This is a new screen (`ExchangeView`) that replaces the current flow of ProfileView → match button → ContactView. It handles the entire exchange lifecycle.

### 3.1 Layout States

#### State A: Waiting (no matches yet)
- App Clip QR code, **vertically centered** on screen
- User's avatar overlaid in the QR code's center circle (animated: avatar shrinks from full size into QR center)
- Subtle pulse animation on QR or "Waiting for connections..." text below
- Secondary CTA at bottom: "Never mind" (exits exchange, returns to Profile)

#### State B: First match arrives (auto-transition)
- **Auto-navigates** — no "Match found" button
- QR code animates upward to pin at top of screen
- Avatar stays embedded in QR center
- First contact card slides in above, similar zoom into today (just behind the qr code, lower z index)
- Primary CTA appears: "Save Contact"
- Secondary CTA: "Nah, who this" (exits exchange without saving)

#### State C: 2+ matches
- QR code remains pinned at top (same position as State B)
- **Stacked heads row** appears between QR and card list — overlapping small circular avatars (32px) showing all matched people. First head will already be there, so this will just shift left, and the new one fades in. Tapping a head scrolls to that card.
- Contact cards stack in a scrollable list below
- New matches animate in at the **top** of the card list (most recent first for attention)
- Primary CTA changes to: **"Save All Contacts (N)"** where N is the number of contacts — sticky at bottom
- "Nah, who this" is also sticky
- Individual cards have a trash icon button to exclude specific contacts from save

### 3.2 Single vs. Multi Contact Card Design

**Decision: Use the normal ContactInfo card for the first/only contact, condense when 2+ arrive.**

This gives a single exchange a personal, impactful feel (close to today's ContactInfo) while remaining compatible with the QR-at-top layout.

#### Condensed ContactInfo Card (2+ contacts)
- Layout: Chip
- Left: Small avatar (same size as contact chips on history)
- Top line: Name (same style as contact chips) + subtitle (title/company or location, 1 line)
- Below: Compact social icon row, icons are tappable, use existing component. might need to cap to maximum number
- Right: trash icon button
- Tap → full ContactView (with back to return to exchange)

**Transition**: When the second match arrives, the first card smoothly animates from normal → condensed. This signals "we're in group mode now."

### 3.3 CTA Behavior Summary

| State | Primary CTA | Secondary CTA |
|-------|-------------|---------------|
| 0 matches (waiting) | — | "Never mind" |
| 1 match | "Save Contact" | "Nah, who this" |
| 2+ matches | "Save All Contacts (N)" (sticky) | "Nah, who this" (sticky) |
| Post-save | "Done" / navigate to Profile | — |

### 3.4 Post-Save Flow

After tapping Save (single or all):

#### Contact Saving (per platform)
- **iOS app**: Save all contacts to native phone contacts (existing `saveContactFlow` for each person)
- **Web (iOS Safari)**: Download vCards — one `.vcf` file per person (triggers browser download for each). Consider combining into a single multi-contact vCard if supported.
- **Web (Android)**: Save to Google Contacts via People API (existing incremental auth flow, one `createContact` call per person)

#### Success Modal
- If group (2+), a Group is automatically created in Firestore (see Section 10)
- Show success modal similar to today but adjusted for groups:

**Single contact** (same as today):
- Title: "Contact Saved!"
- Primary CTA: "Say hi" → opens SMS to that person with message: "Hey, this is {senderName}. You can stalk me here: https://nekt.us/c/{senderShortCode}"
- Secondary CTA: "Nah, they'll text me" → dismisses modal

**Group (2+ contacts)**:
- Title: "Contacts Saved!"
- Primary CTA: "Say hi" → opens a **group SMS** with all saved contacts' phone numbers. Message: "Hey, this is {senderName}. You can stalk me here: https://nekt.us/c/{senderShortCode}"
- Secondary CTA: "Nah, they'll text me" → dismisses modal

#### After Modal Dismissal
- Primary CTA on exchange page becomes: **"Done"** → navigates back to Profile
- Secondary CTA below Done: **"Schedule a meetup"** → navigates to Smart Schedule (single contact) or Group Smart Schedule (group)

### 3.5 Background Color Cycling

The exchange page background smoothly cycles through each participant's `backgroundColors`:

- **0 matches (waiting)**: User's own background colors
- **1 match**: Transition to the matched contact's colors (same as today)
- **2+ matches**: Cycle through all participants' colors on a loop — 5-second hold per person, 1-second smooth transition between. Starts with the user's own colors. New participants are added to the rotation as they join.

**Implementation**: `react-native-reanimated` `interpolateColor` on iOS; CSS transitions on web.

### 3.6 Anon Exchange Page (App Clip / Web without auth)

When an unauthenticated user opens the session URL (`/x/{token}`), they see:

- **App Clip / Web**: The same exchange page layout but with a sign-in gate
- Shows the session participants (names + avatars, blurred social icons)
- Primary CTA: "Sign in with Apple" (App Clip) or "Sign in" (web)
- After sign-in:
  - User joins the session
  - Their profile is shared to all other participants
  - They see all other participants' full contact cards
  - Their phone now shows the session QR code too
  - Same save flow as authenticated users

This replaces the current `AnonContactView` for exchange sessions. The existing `AnonContactView` can remain for direct profile views (`/c/{code}`).

---

## 4. Connections Page (renamed from History)

### 4.1 Tab Rename
"History" → **"Connections"**

### 4.2 Filters & Sorting
Three dropdown selectors at the top (using existing `DropdownSelector` component):

| Dropdown | Options | Default |
|----------|---------|---------|
| **View** | All, Groups, Contacts | All |
| **Type** | All, Personal, Work | All |
| **Sort** | Date Added, Alphabetical | Date Added |

- "All" view interleaves individual contacts and group chips chronologically
- "Groups" shows only group chips
- "Contacts" shows only individual contacts (including those that are part of groups)

### 4.3 Group Chip
New chip variant for groups in the list:

- **Left**: Stacked/overlapping small avatars (first 3 members, with +N indicator if more)
- **Title**: "Alex, Sarah, and 3 others" (for 5 people); "Alex, Sarah, Mike" (for 3 or fewer)
- **Subtitle**: Date (same as contact)
- **Right CTA**: Meeting (Smart Schedule)
- **Tap**: Navigate to GroupView

### 4.4 + Button — Create Group (inline mode)
A circular + button in the top-right header. Tapping it enters **"Add Mode"** — an inline selection experience on the Connections page itself (no modal/sheet):

#### Entering Add Mode
1. **+ button animates into a search box** that replaces the header bar (search input slides/expands in from the + button position)
2. View filter automatically switches to **"Contacts"** and the View dropdown is **disabled** (grayed out) — you can only select from individual contacts, not groups
3. The right-side action icon (calendar/chevron) on each contact chip is **hidden**
4. A sticky bottom bar appears with a "Create Group" button (disabled until 2+ selected)

#### Selecting Contacts
- **Tap a contact** → selects it:
  - Avatar is replaced by a **checkmark in a circle** (same size, filled dominant color)
  - Contact is **pinned to the top** of the list (selected contacts stack at top, maintaining selection order)
- **Tap a selected contact** → deselects it:
  - Checkmark reverts to avatar
  - Contact returns to its natural position in the list
- **Type in search box** → filters the contact list by name (real-time)
- **Selecting a contact clears the search input** (so the full list is visible again for the next pick)

#### Creating the Group
1. Once 2+ contacts are selected, the "Create Group" button enables
2. Tapping it prompts for a group name (optional — defaults to member names)
3. Group created in Firestore, exits Add Mode, navigates to GroupView

#### Exiting Add Mode
- **X button** on the search bar (or tapping outside/back gesture) exits Add Mode
- Restores the normal header, re-enables filters, deselects all contacts

### 4.5 Individual Contact Chips
Same as today's `ItemChip` — avatar, name, timestamp, calendar action icon. No changes needed.

---

## 5. GroupView

New screen for viewing a group of contacts. **Should look very similar to ExchangeView (State C)** — reuses the same stacked heads and condensed ContactInfo card components.

### Layout
- **Top**: Same **stacked heads row** component used on the exchange page (overlapping small circular avatars, 32px)
- **Below heads**: Group name/title (editable — pencil icon to rename)
- **Member list**: Same **condensed ContactInfo cards** from ExchangeView — chip layout with avatar, name, subtitle, tappable social icons. No trash button here (unlike exchange page).
  - Tap → navigate to their ContactView
- **Action buttons** at bottom:
  - "Schedule Group Meetup" → Group Smart Schedule
  - "AI Schedule" → Group AI Schedule

### URL
`/g/{groupShortCode}` — 8-character shortcode (same generation as user shortCodes)

---

## 6. URL Structure & Routing

### Updated Routes

| Path | Purpose | Screen | Change |
|------|---------|--------|--------|
| `/x/{token}` | Exchange session | ExchangeView | **Existing route** — token now represents a session instead of a single user |
| `/g/{groupCode}` | View a group | GroupView | New |
| `/g/{groupCode}/smart-schedule` | Smart schedule for a group | SmartScheduleView (group mode) | New |
| `/g/{groupCode}/ai-schedule` | AI schedule for a group | AIScheduleView (group mode) | New |
| `/s/{scheduleCode}` | Shareable AI scheduling session | AIScheduleView (join mode) | New |
| `/c/{userCode}` | View a user's profile | ContactProfileView | Unchanged |
| `/c/{userCode}/smart-schedule` | Smart schedule with a single contact | SmartScheduleView | Unchanged |
| `/c/{userCode}/ai-schedule` | AI schedule with a single contact | AIScheduleView | Unchanged |

### Navigation Params (updated)

```typescript
export type RootStackParamList = {
  // ... existing routes ...
  Exchange: { token: string };  // same token format as today, now represents a session
  Group: { groupCode: string };
  GroupSmartSchedule: { groupCode: string; backgroundColors?: string[] };
  GroupAISchedule: { groupCode: string; backgroundColors?: string[] };
  AISchedule: {
    contactUserId?: string;     // single contact
    groupCode?: string;         // group
    scheduleCode?: string;      // join via shared link
    backgroundColors?: string[];
    savedContact?: any;
  };
};
```

---

## 7. Smart Scheduling (Groups)

### Changes from 1:1
- **Input**: Array of `contactUserIds` (all group members) instead of single `contactUserId`
- **Availability**: Fetch busy/free for ALL participants. For each 30-min slot in the 14-day window, compute how many participants are free.
- **Event creation**: Calendar invite includes all participant emails as attendees
- **Entry points**: From GroupView CTA, from post-save prompt on exchange page, from Connections group chip

### Availability Pill Badge
Each suggestion chip gets a **colored pill badge on the right side** showing availability fraction. Always shown on every chip.

| Availability | Color | Example |
|-------------|-------|---------|
| 100% (all free) | Green | `5/5` |
| &gt;50% | Yellow | `3/5`, `4/5` |
| &le;50% | Red | `2/5`, `1/5` |

No minimum threshold — showing something is better than nothing. The ranking algorithm pushes low-availability slots to the bottom naturally.

### Suggestion Ranking Algorithm
For group scheduling, the ranking algorithm extends the current logic with availability as the primary sort key:

1. **Maximum availability first**: Prioritize slots where the most participants are free (e.g., 5/5 slots before 4/5 slots)
2. **Tie-break: soonest day**: Among slots with equal availability, prefer the earliest date
3. **Tie-break: midpoint of preferred hours**: Among slots on the same day with equal availability, prefer the slot closest to the midpoint of the event type's preferred schedulable hours (existing logic — e.g., lunch slots centered around 12:30)
4. **Travel buffer**: For in-person events, apply the existing 30-min travel buffer before/after when checking availability

This means the top suggestion is always the soonest time where the most people can make it, at the most natural time of day for that event type.

### Location
- Compute the **centroid** of all participants' locations (average lat/lng)
- Run the existing Foursquare place search centered on the centroid, filtered by the event type's place category (coffee, lunch, dinner, drinks, etc.)
- Results are ranked by Foursquare's relevance/distance from centroid

### URL
`/g/{groupCode}/smart-schedule`

---

## 8. AI Scheduling (Groups)

### 8.1 Multi-Person Chat UI

#### Message Attribution
- Small avatar + first name displayed above each message bubble
- Avatar positioned so name text starts where the bubble's top-left border radius ends
- Alignment: Your messages right-aligned, everyone else's left-aligned

#### Color Scheme
- **Your messages**: Right-aligned, current accent color (existing)
- **Other participants**: Left-aligned, neutral color (same for all other humans, like iMessage gray)
- **Nektbot**: Left-aligned, subtle brand-tinted color. Avatar = Nekt logo.

#### Nektbot
- Name: "Nektbot"
- Avatar: Nekt logo
- Greeting adjusts for groups: "I'll help you all find the perfect time & place to meet. Can each of you share your preferences for timing, duration, and type of spot?"

### 8.2 Multi-Person Constraint Extraction
The AI must:
1. **Track constraints per person**: "Sarah: not available at 8pm", "Mike: only Tues or Wed"
2. **Merge with calendar data** for each participant
3. **Surface a summary** before proposing: "Here's what I know so far: Sarah can't do evenings, Mike prefers Tues/Wed, Alex is free all week. Based on calendars, Tuesday at noon works for everyone."
4. **Handle partial conflicts**: "Monday works for 4/5 — Alex has a conflict. Should we go with Monday anyway, or find a time for all 5?"
5. **Extract intent from natural language**: Parse "im not free at 8", "can only do tues or wed", "somewhere near downtown", etc. as structured constraints per person.

### 8.3 Shareable Scheduling URLs
- Path: `/s/{scheduleCode}` — 8-character shortcode
- **TTL**: 7 days from last message sent (auto-extends with activity)
- Anyone with the link can join the scheduling chat and send messages
- Opens AIScheduleView in "join mode" — joins the existing conversation
- Replaces the current per-contact AI schedule URL for group contexts
- **Expired link**: If someone opens the `/s/` link after the TTL expires, show an error message: "This scheduling session has expired."

### 8.4 Share Button
- **Copy link / Share button** in the top-right header of AIScheduleView
- Uses native share sheet (iOS) or clipboard + toast (web)
- Generates the `/s/{scheduleCode}` URL on first share if not yet created

### 8.5 How Others Join
1. Someone in the group taps the share button → gets `/s/{scheduleCode}` URL
2. Sends it via text, AirDrop, group chat, etc.
3. Recipient opens link → joins the AI scheduling conversation
4. Their messages appear with their avatar + name
5. Nektbot acknowledges: "Sarah just joined! Sarah, feel free to share your preferences."

---

## 9. Contact Syncing

Sync contacts from external sources (phone contacts, Google Contacts) into the Connections list, deduplicated with each other and with existing Nektus contacts.

### 9.1 Sources

#### Phone Contacts (iOS)
- Use the Contacts framework (`expo-contacts`) to read the device address book
- **Permission**: Request Contacts access on first visit to Connections page, or during onboarding. If denied, Connections page works fine with only Nektus contacts.

#### Google Contacts
- **No new OAuth scope needed.** The app already requests `https://www.googleapis.com/auth/contacts` via incremental authorization (used today for writing contacts to Google). This same scope grants read access via the People API `people.connections.list` endpoint.
- **Availability**: Web (Google OAuth), and iOS (if user signed in with Google)

### 9.2 Sync Process

1. **Fetch + Normalize** (parallel):
   - Phone contacts (client-side): Read from device via `expo-contacts`, normalize phone numbers (E.164) and lowercase emails
   - Google contacts (server-side): Call People API `people.connections.list` using the stored OAuth token. Server normalizes and returns via `/api/contacts/google/sync`. Supports `syncToken` for incremental/delta sync.
2. **Client merges both sets** — it's the natural merge point since it's the only place both datasets exist simultaneously. Dedupe is lightweight (set intersection on normalized phone/email strings).
3. **Deduplicate across sources** (client-side): Match on (normalized phone number) OR (normalized email). Merge into a single contact record, preferring the richer data source for each field.
4. **Deduplicate against Nektus contacts** (client-side): If a synced contact matches an existing Nektus contact (by phone or email), link them rather than creating a duplicate. The Nektus profile data takes priority (it's richer), but phone/Google data fills in any gaps.
5. **Store** (Firestore): Save deduplicated synced contacts to the existing `profiles/{userId}/contacts/{contactUserId}` collection with appropriate `sources` array (see Section 10.4). This keeps them available server-side for scheduling/AI and persistent across devices.

### 9.3 Display in Connections

- Synced contacts appear in the Connections list alongside Nektus contacts
- **Visual distinction**: Synced-only contacts (no Nektus profile) show a subtle indicator (e.g., phone icon or Google icon badge on their avatar) so users know these aren't Nektus exchanges
- **Tap behavior**: Opens a simplified contact view (name, phone, email, available social links) — not the full ContactView (which requires a Nektus profile)
- **Filters**: Synced contacts appear in the "Contacts" view filter but NOT in the "Groups" or "All Exchanges" views (since they weren't exchanged)

### 9.4 Sync Trigger & Frequency

- **Trigger**: On **app launch** and on **Profile page view**, if last sync was >1 hour ago
- **Initial sync**: Full pull on first run after permission grant
- **Incremental sync**: On subsequent triggers, only fetch changes (Google People API supports `syncToken` for delta sync; iOS Contacts framework supports `CNContactStore` change notifications)
- **Background**: Sync should not block UI. Fetch in background, update list when ready.

### 9.5 Data Model

No new collection — synced contacts use the existing `profiles/{userId}/contacts/{contactUserId}` collection. The `SavedContact` schema is extended (see Section 10.4).

---

## 10. Data Model Changes

### 10.1 Exchange Sessions (Firestore)

Replaces the current Redis-based `exchange_match:{token}` and `pending_exchange:{sessionId}` keys. Redis is still used for bump matching (transient, timing-sensitive), but once a match is found it creates/joins a Firestore session.

**Current Redis schema** (for reference):
```
exchange_match:{token} → { sessionA, sessionB, userA: UserProfile, userB: UserProfile,
                           timestamp, status, sharingCategoryA, sharingCategoryB,
                           scanStatus, previewAccessedAt }
pending_exchange:{id}  → { userId, profile: UserProfile, timestamp, serverTimestamp,
                           location, mag, vector, sessionId, sharingCategory }
```

**New Firestore schema**:
```
Collection: exchangeSessions/{token}
{
  token: string;               // Same format as today's exchange tokens, used in /x/{token} URL
  createdBy: string;           // userId of initiator
  status: 'active' | 'concluded' | 'expired';  // concluded = all participants saved/dismissed
  participants: [{
    userId?: string;             // null/absent while pending_auth
    status: 'pending_auth' | 'joined';  // Replaces Redis scanStatus
    sharingCategory?: string;    // 'Personal' | 'Work' — set once joined
    joinedAt: Timestamp;
    joinMethod: 'initiator' | 'qr-scan' | 'ble' | 'bump';
    scannedAt?: Timestamp;       // When QR was scanned (replaces Redis previewAccessedAt)
  }];
  createdAt: Timestamp;
  concludedAt?: Timestamp;
  expiresAt: Timestamp;        // Auto-cleanup: createdAt + 1 hour
}
```

**Key differences from Redis schema**:
- **No inline UserProfile** — profiles are fetched by `userId` as needed (Firestore docs should stay small for real-time listeners). Redis stored full profiles inline for instant access; Firestore doesn't need to since clients can fetch profiles in parallel.
- **N-party** — `participants[]` array replaces the two-party `sessionA`/`sessionB` pattern
- **`sharingCategory` per participant** — preserved from current schema, determines which fields each person shares
- **`status` per participant** — replaces Redis `scanStatus`. A `pending_auth` entry (no `userId` yet) is added when someone scans the QR but hasn't signed in. Updated to `joined` with their `userId` once authenticated. This lets the initiator show "Someone's joining..." on the exchange button before the page auto-navigates.
- **`scannedAt`** — replaces Redis `previewAccessedAt`
- **No bump-specific fields** (`mag`, `vector`, `location`, `timestamp`) — those remain in Redis for the transient bump matching algorithm. Once a bump match is confirmed, it creates a Firestore session with 2 participants.

**Real-time**: Participants subscribe via `onSnapshot` to see new members join. The `pending_auth` → `joined` transition is only relevant before the first full match triggers auto-navigation; after that, new participants simply appear as contact cards.

### 10.2 Groups (Firestore)

```
Collection: groups/{groupId}
{
  groupId: string;
  shortCode: string;           // 8-char, used in /g/{code} URLs
  name?: string;               // User-editable name; defaults to member names
  memberUserIds: string[];
  createdBy: string;           // userId
  exchangeSessionToken?: string; // Link to originating exchange session (if any)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Also stored per-user for querying**:
```
Collection: profiles/{userId}/groups/{groupId}
{
  groupId: string;
  shortCode: string;
  name?: string;
  memberUserIds: string[];     // Denormalized for fast reads
  createdAt: Timestamp;
}
```

### 10.3 AI Schedule Sessions (Firestore)

```
Collection: scheduleSessions/{scheduleCode}
{
  scheduleCode: string;        // 8-char shortcode, used in /s/{code} URLs
  type: 'individual' | 'group';
  groupId?: string;            // If group scheduling
  contactUserId?: string;      // If individual scheduling
  participantUserIds: string[];
  messages: [{
    id: string;
    userId: string | 'nektbot';
    content: string;
    event?: Event;             // Structured event data
    timestamp: Timestamp;
  }];
  extractedConstraints: [{     // AI-maintained constraint state
    userId: string;
    constraints: string[];     // Natural language constraints
    parsedTimes?: TimeRange[]; // Structured time constraints
  }];
  lastMessageAt: Timestamp;
  expiresAt: Timestamp;        // lastMessageAt + 7 days
  createdAt: Timestamp;
}
```

### 10.4 Updated SavedContact

The existing `profiles/{userId}/contacts/{contactUserId}` collection is reused for all contacts — Nektus exchanges, phone imports, and Google imports. The schema is extended:

```
Collection: profiles/{userId}/contacts/{contactUserId}
{
  // Existing fields (unchanged)
  odtId: string;
  odtName: string;
  userId: string;               // contactUserId — same as document ID
  addedAt: number;
  profileImage?: string;
  phone?: string;
  email?: string;
  contactType?: 'personal' | 'work';
  backgroundColors?: string[];

  // New fields
  sources: string[];            // Array of: 'nektus', 'phone', 'google' — can be all three
  phoneNumbers?: string[];      // All normalized E.164 numbers (from phone/Google sync)
  emails?: string[];            // All lowercase emails (from phone/Google sync)
  company?: string;             // From phone/Google
  title?: string;               // From phone/Google
  socialLinks?: Record<string, string>;  // From Google (if available)
  lastSyncedAt?: Timestamp;     // Last time this contact was updated via sync
}
```

**Document ID / keying**:
- Nektus contacts: keyed by the other user's Nektus `userId` (as today)
- Synced-only contacts: keyed by a generated `contactUserId` (e.g., deterministic hash of normalized primary phone + email, so re-syncing dedupes naturally)
- When a synced contact matches an existing Nektus contact (by phone or email), they merge into the existing document — `sources` array is updated to include all origins

**Migration**: Existing contacts get `sources: ['nektus']` backfilled.

---

## 11. Implementation Notes

### 11.1 Exchange Token Semantics Change
- The `/x/{token}` route and token format stay the same — no URL migration needed
- The backend changes what a token represents: instead of mapping to a single user's profile, it maps to a session with multiple participants
- The `/api/exchange/pair/{token}` endpoint needs to be updated to return **session data** (all participants) rather than a single profile
- BLE service exchanges the same token — it now represents the session both peers join

### 11.2 Duplicate Prevention
- Existing behavior: Saving a contact that already exists in `profiles/{userId}/contacts/{contactUserId}` updates rather than duplicates
- This continues to work for group exchanges — each participant is saved individually
- No additional dedup logic needed

### 11.3 Personal/Work Sharing in Groups
- Each participant's sharing category (Personal/Work) is set independently before/during exchange
- Contact cards show the fields appropriate to what each person chose to share
- Mixed group is fine: Person A shares Personal, Person B shares Work

### 11.4 Web Parity
- Web cannot use Apple App Clip codes, but shows a **standard QR code** encoding the same `/x/{token}` URL
- BLE may not be available on web; QR scan is the primary web exchange method
- All other features (exchange page, connections, groups, scheduling) work identically on web

### 11.5 App Clip Code Web Fallback
App Clip codes DO fall back to the web. When scanned on Android or any non-Apple device, the encoded URL (`https://nekt.us/x/{token}`) opens in the browser, serving the web exchange experience. No separate QR code is needed alongside the App Clip code for cross-platform support.

