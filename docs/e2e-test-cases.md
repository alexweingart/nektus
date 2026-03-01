# E2E Test Cases

**User archetypes**

- **Existing** — signed-in user with a complete profile
- **New** — no account; will hit AnonContact View and sign-up flow

---

## 1. Exchange Flows

Each exchange variant follows the **full E2E happy path**:

> **Deep Link / Entry > Profile > Nekt > Scan/Bump > (AnonContact View & Sign Up) > Match > Contact View > Save > (Connect Calendar) > Smart Schedule > AI Schedule > History**

Not every variant needs every step — the matrix marks what to cover.

### Exchange matrix

| # | Variant | Method | User A | User B | Deep Link? | AnonContact + Sign Up? | Calendar Connect? | Full Schedule? | History? |
|---|---------|--------|--------|--------|------------|------------------------|-------------------|---------------|----------|
| 1.1 | Bump: iOS <> Android | Bump | iOS existing | Android existing | No | No | No (already connected) | Yes | Yes |
| 1.2 | QR: Android existing > iOS new (Clip) | QR | Android existing | iOS new (App Clip) | Yes (User B via QR deep link) | Yes (User B) | Yes (User B) | Yes | Yes |
| 1.3 | QR: Android existing > Android new | QR | Android existing | Android new (web) | Yes (User B via web link) | Yes (User B, web) | Yes (User B) | Yes | No |
| 1.4 | QR: iOS app > Android new | QR | iOS existing | Android new (web) | Yes (User B via web link) | Yes (User B, web) | No | No | No |
| 1.5 | QR: iOS app > iOS new (Clip) | QR | iOS existing | iOS new (App Clip) | Yes (User B via QR deep link) | Yes (User B) | No | Smart only | No |
| 1.6 | QR: iOS app > iOS app | QR | iOS existing | iOS existing | No | No | No | Smart only | No |
| 1.7 | Bluetooth: iOS <> iOS | BLE | iOS existing | iOS existing | No | No | No | No | No |

### 1.1 Bump: iOS existing <> Android existing
The golden path — two existing users, all steps.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Both users open Profile tab | Profile loads with avatar, name, socials |
| 2 | Both tap **Nekt** button | Exchange screen appears; motion detection starts |
| 3 | Bump devices together | Devices detect bump; matching begins |
| 4 | Match resolves | Both see Match screen with the other's name + photo |
| 5 | Both land on **Contact View** | Full profile card of the other user; save CTA visible |
| 6 | Tap **Save Contact** | iOS: Firebase + iOS Contacts (native); Android: Firebase + Google Contacts |
| 7 | Tap **Smart Schedule** | Common available times shown based on both calendars |
| 8 | Select a time + activity | Calendar event preview shown |
| 9 | Tap **AI Schedule** | Chat opens; AI suggests times/places based on availability + location |
| 10 | Confirm AI suggestion | Calendar event created; confirmation shown |
| 11 | Open **History** tab | New contact appears at top with "Today" timestamp |
| 12 | Tap contact in History | Contact View loads correctly |

### 1.2 QR: Android existing > iOS new via App Clip
The core new-user acquisition path. Covers deep link entry, sign-up, calendar connect, and full scheduling.

| Step | Action | Expected |
|------|--------|----------|
| 1 | User A (Android) opens Profile > taps **Nekt** | QR code displayed with unique token |
| 2 | User B (iOS, no app) scans QR | Deep link resolves; App Clip launches |
| 3 | App Clip shows **AnonContact View** | User A's profile displayed; sign-up CTA visible |
| 4 | User B taps **Save / Sign Up** | Apple Sign-In prompt > profile setup flow |
| 5 | User B completes profile setup | Match created; both users see Contact View |
| 6 | User A sees match notification | Contact View shows User B's profile |
| 7 | Both save contact | User A (Android): Firebase + Google Contacts; User B (App Clip): Firebase (fire-and-forget) + native contact form |
| 8 | User B connects calendar | Settings > Add Calendar > Google/Apple > authorize; calendar shows as connected |
| 9 | User A opens **Smart Schedule** | Available times shown (using both calendars) |
| 10 | User A opens **AI Schedule** | AI conversation works; event created |
| 11 | Both check **History** | Contact appears in both users' history |

### 1.3 QR: Android existing > Android new — web flow
Tests the web AnonContact View + web sign-up path. User B hits `nekt.us/x/{token}`.

| Step | Action | Expected |
|------|--------|----------|
| 1 | User A (Android) shows QR | QR displayed |
| 2 | User B (Android, no app) scans QR | Browser opens `nekt.us/x/{token}` |
| 3 | **Web AnonContact View** loads | User A's profile shown; Get the App / sign-up CTA |
| 4 | User B signs up (web flow) | Google Sign-In > profile setup on web |
| 5 | Match created | Both users see Contact View |
| 6 | User B connects calendar (web) | Calendar connected via web settings |
| 7 | Smart Schedule + AI Schedule | Both work from web and app respectively |

### 1.4 QR: iOS app > Android new — web flow
Same web path as 1.3 but originating from iOS. Validates cross-platform QR deep link.

| Step | Action | Expected |
|------|--------|----------|
| 1 | User A (iOS) shows QR | QR displayed |
| 2 | User B (Android, new) scans QR | Browser opens `nekt.us/x/{token}`; web AnonContact View loads |
| 3 | User B signs up (web) | Match created |
| 4 | Both see Contact View | Save works both sides |

### 1.5 QR: iOS app > iOS new via App Clip
| Step | Action | Expected |
|------|--------|----------|
| 1 | User A (iOS) shows QR | QR displayed |
| 2 | User B (iOS, no app) scans QR | Deep link resolves; App Clip launches with AnonContact View |
| 3 | User B signs up via App Clip | Profile setup within App Clip context |
| 4 | Match created | Both see Contact View |
| 5 | Both save contact | Contacts saved |
| 6 | **Smart Schedule** from User A | Times shown; event can be created |

### 1.6 QR: iOS app > iOS app
| Step | Action | Expected |
|------|--------|----------|
| 1 | User A shows QR | QR displayed |
| 2 | User B scans with in-app scanner | Match created directly (no sign-up needed) |
| 3 | Contact View > Save | Contact saved both sides |
| 4 | **Smart Schedule** | Times shown; event can be created |

### 1.7 Bluetooth: iOS <> iOS
| Step | Action | Expected |
|------|--------|----------|
| 1 | Both users tap **Nekt** | BLE discovery starts |
| 2 | Devices discover each other | Pairing prompt or auto-match |
| 3 | Exchange completes | Match screen shown |
| 4 | Contact View > Save | Contact saved both sides |

---

## 2. Save Flow Details

Save behavior differs by platform. Firebase save always happens. Native contact save depends on the platform.

### Platform save matrix

| Save target | iOS App | App Clip | Android / Web |
|-------------|---------|----------|---------------|
| Firebase | Always | Always (fire-and-forget) | Always |
| iOS Contacts (native) | Yes (permission prompt) | No (opens native contact form instead) | N/A |
| Google Contacts | Never | Never | Yes (OAuth permission) |
| vCard | Fallback if permission denied | Via native share sheet | Android: `.vcf` download; iOS web: inline open |
| Google Contacts upsell | Never | Never | Yes (if permission missing) |
| Say hi | SMS via `Linking.openURL` | SMS via `Linking.openURL` | SMS on mobile; clipboard on desktop |

### Sub-cases

| # | Case | Platform | Precondition | Steps | Expected |
|---|------|----------|-------------|-------|----------|
| 2.1 | Firebase-only save | Any | No native contact permissions granted | Tap Save | Saved to Firebase; appears in History |
| 2.2 | Save to iOS Contacts | iOS app | Contacts permission granted | Tap Save | Contact added to iOS Contacts via `react-native-contacts` |
| 2.3 | iOS Contacts permission denied > vCard fallback | iOS app | Contacts permission denied | Tap Save | vCard generated with photo; share sheet opens |
| 2.4 | App Clip native contact form | App Clip | N/A (no permission requested) | Tap Save | Firebase save (fire-and-forget) + native "Add Contact" form opens with name/phone/email pre-filled |
| 2.5 | Save to Google Contacts | Android / Web | Google Contacts permission granted | Tap Save | Firebase + Google Contacts save; contact synced |
| 2.6 | Google Contacts upsell | Android / Web | First save, no Google Contacts permission | Tap Save | Firebase saves; upsell modal: "Save to Google Contacts?" > Yes redirects to OAuth, Nah keeps Firebase-only |
| 2.7 | vCard download (Android web) | Android web | After save | Automatic | `.vcf` file downloaded with photo + social profiles |
| 2.8 | vCard inline (iOS web) | iOS web (non-embedded browser) | After save | Automatic | vCard opens inline via native Contacts picker |
| 2.9 | Say hi | Any | Contact has phone number | Tap "Say hi" on success modal | Opens SMS with pre-filled message including Nekt profile link |

---

## 3. Scheduling Flow Details

These sub-cases apply within any exchange variant at the scheduling steps.

### Calendar Provider Connection

| # | Case | Platform | Steps | Expected |
|---|------|----------|-------|----------|
| 3.0a | Connect Google Calendar | iOS / Web | Settings > Add Calendar > Google > authorize | OAuth flow completes; calendar shows as connected; busy times available |
| 3.0b | Connect Apple Calendar (CalDAV) | iOS / Web | Settings > Add Calendar > Apple > enter Apple ID + app-specific password | Credentials validated via CalDAV; calendar shows as connected; busy times available |
| 3.0c | Apple CalDAV — invalid credentials | iOS / Web | Enter wrong Apple ID or password | Error message shown; calendar not connected |
| 3.0d | Switch providers | iOS / Web | Disconnect Google > connect Apple (or vice versa) | Old provider removed; new provider's availability reflected immediately (cache invalidated) |
| 3.0e | Both providers connected | iOS / Web | Connect Google (work) + Apple (personal) | Both calendars contribute to availability; Smart Schedule shows merged busy times |

### Smart Schedule

| # | Case | Precondition | Steps | Expected |
|---|------|-------------|-------|----------|
| 3.1 | Times shown | Both users have calendars connected | Open Smart Schedule | Available common times displayed |
| 3.2 | No calendar | One/both users have no calendar | Open Smart Schedule | Graceful fallback; prompt to connect calendar |
| 3.3 | Select activity | Times available | Pick time + activity (Coffee, Lunch, etc.) | Event preview with correct details |
| 3.4 | Create event | Event previewed | Confirm event | Calendar event created; opens in native calendar |

### AI Schedule

The AI uses a 5-stage pipeline: intent classification > template generation > calendar/places lookup > event selection > response. Two core paths to test:

#### 3.5 Direct scheduling — specific time + activity

Tests the `handle_event` intent path where the user gives a concrete request.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open AI Schedule from a saved contact | Chat loads; common times pre-fetched in background |
| 2 | Send: **"Let's grab coffee Tuesday at 2pm"** | Acknowledgment: "Sure — let me find time!" |
| 3 | AI processes | Typing indicator shown while streaming |
| 4 | Response streams in | Event card appears with title ("Coffee"), day, time, and duration |
| | | Place suggestions with Google Maps links (top 3 from Foursquare, near midpoint of both users) |
| | | Alternative times listed below if the exact time is unavailable |
| 5 | Tap **Create Event** on event card | Calendar event created with correct title, time, location; opens in native calendar (iOS) or Google/Outlook (web) |

**Verify:**
- Event card renders with correct time (2:00 PM or nearest available slot)
- Place links open Google Maps
- If 2pm is unavailable, conflict message shown with alternatives in a 2-week window
- Travel buffer (30min before/after) applied for in-person events
- Calendar event has correct details after creation

#### 3.6 Suggestion-based — open-ended prompt

Tests the `suggest_activities` intent path where the AI recommends ideas and searches for events.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open AI Schedule from a saved contact | Chat loads |
| 2 | Send: **"What should we do this weekend?"** | Acknowledgment: "Great question — let me find some ideas for you!" |
| 3 | AI responds immediately | Bullet list of ~5 activity suggestions (e.g., coffee/brunch, outdoor walk, try a restaurant, etc.) |
| | | Message: "I'm also searching for special events happening this weekend!" |
| | | Loading spinner while background web search runs |
| 4 | Background search completes (~3-5s) | Second message appears with local events (concerts, markets, festivals, etc.) with dates/times/venues |
| 5 | Reply with a pick: **"Let's do the <xxx> one"** | Intent switches to `handle_event`; AI finds available time in coffee-friendly hours (7am-5pm) and suggests places |
| 6 | Event card appears | Same flow as 3.5 step 5 — create event from card |

**Verify:**
- Activity suggestions appear quickly (before web search finishes)
- Web search enhancement message arrives separately after a few seconds
- Selecting an activity transitions to the scheduling flow with appropriate time constraints (e.g., dinner = 5-9pm, coffee = 7am-5pm)
- Multi-turn context preserved — AI remembers "this weekend" from the original message

#### 3.7 Other AI sub-cases

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 3.7a | Edit time | After event card shown, send "Can we do it earlier?" | AI calls `editEventTemplate`; new event card with earlier time |
| 3.7b | Specific venue | Send "Dinner at Rich Table next Friday" | AI searches for that specific place; event card includes venue address + Google Maps link |
| 3.7c | Time conflict | Request a time when both users are busy | Conflict message with alternatives near the requested time |

### Scheduling Notification Email

When an event is created with someone who has a relay email (@privaterelay.appleid.com) or no direct calendar integration, a notification email is sent via Resend instead of a calendar invite.

| # | Case | Precondition | Steps | Expected |
|---|------|-------------|-------|----------|
| 3.8a | Email sent (relay address) | Attendee signed in with Apple (relay email) | Create event via AI Schedule | Email sent from `nektbot@nekt.us`; subject: `"{title}" with {name}`; body has event details + "Lock it in" CTA linking to `nekt.us/i/{inviteCode}` |
| 3.8b | Email sent (no attendee email) | Attendee has no email in profile | Create event | Same notification email sent |
| 3.8c | Direct invite (valid email) | Attendee has real email + Google Calendar | Create event | Google Calendar invite sent directly (no Resend email); attendee gets native calendar notification |
| 3.8d | Email content verification | Relay email scenario | Create event with location | Email includes formatted date/time in user's timezone, location with Google Maps link, organizer name |
| 3.8e | Email send failure | Resend API down or invalid email | Create event | Event still created on organizer's calendar; email failure handled gracefully (no crash, error logged) |

---

## 4. Deep Link Entry Points

Test these at the start of relevant flows to verify links resolve correctly.

| # | Case | Entry | Expected | Tested in |
|---|------|-------|----------|-----------|
| 4.1 | QR deep link > App Clip | Scan QR → `nekt.us/x/{token}` on iOS without app | App Clip launches with AnonContact View | 1.2, 1.5 |
| 4.2 | QR deep link > Web | Scan QR → `nekt.us/x/{token}` on Android without app | Web AnonContact View loads | 1.3, 1.4 |
| 4.3 | QR deep link > In-app | Scan QR → `nekt.us/x/{token}` on device with app installed | App opens; match created directly | 1.6 |
| 4.4 | Shortcode link | Open `nekt.us/c/{code}` in browser | Contact profile loads on web | Standalone |
| 4.5 | Widget deep link | Tap iOS lock screen widget | App opens via `nekt://profile?autoNekt=true`; Profile loads; exchange auto-starts | Standalone |
| 4.6 | Widget deep link (app not running) | Kill app > tap widget | App cold-launches to Profile; autoNekt param triggers exchange | Standalone |

---

## 5. Standalone Flows

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 5.1 | **Edit profile** | Profile > Edit > change name, phone, add social link > save | Changes persist after app restart |
| 5.2 | **Profile photo upload** | Edit > tap photo > pick from gallery | Photo uploaded; background color extracted |
| 5.3 | **Delete contact from History** | History > swipe/delete a contact | Contact removed from list and Firebase |
| 5.4 | **App Clip > SKOverlay** | Complete App Clip save flow | Save contact in App Clip | SKOverlay (install banner) appears ~600ms after contact save; tapping installs full app |
| 5.5 | **App Clip > Say hi** | After contact save in App Clip | Tap "Say hi" on success modal | SMS opens pre-filled with message including Nekt profile link |
| 5.6 | **Widget CTA** | First launch via widget deep link | Tap widget > complete exchange | "Add to Lock Screen" CTA hidden permanently after first widget-initiated exchange (AsyncStorage flag) |

---

## Suggested Test Run Order

For a full regression pass:

1. **3.0a–3.0e** — Calendar provider connection (Google, Apple CalDAV, switching, both)
2. **1.1** — Bump (golden path: both existing users, full flow including history)
3. **1.2** — QR > App Clip (deep link + sign-up + calendar connect + scheduling + history)
4. **1.5** — QR iOS > iOS Clip (same platform Clip variant)
5. **1.3** — QR Android > Android new (web flow + calendar connect)
6. **1.6** — QR iOS > iOS app (existing-to-existing QR)
7. **1.7** — Bluetooth
8. **1.4** — QR iOS > Android new (web cross-platform)
9. **2.1–2.9** — Save flow variants (if not already covered above)
10. **3.1–3.7** — Scheduling edge cases (if not already covered above)
11. **3.8a–3.8e** — Scheduling notification email (relay vs direct, failure handling)
12. **4.4–4.6** — Standalone deep links + widget deep links
13. **5.1–5.6** — Profile edit, photo, delete contact, App Clip SKOverlay, widget CTA

---

## Notes

- **Test devices needed**: minimum 2 iOS devices (one with app, one without for Clip), 1 Android device
- **Test accounts**: at least 2 existing accounts with calendars connected (one Google, one Apple CalDAV); ability to create fresh accounts for "new user" variants
- **Apple CalDAV**: test account needs an app-specific password generated at appleid.apple.com/account/security
- **Network**: devices must be on same network for bump; BLE requires physical proximity
- **App Clip reset**: delete App Clip data between runs to test fresh Clip experience
- **Simulator limitations**: bump and BLE cannot be tested on simulators; use physical devices
- **Web coverage**: variants 1.3 and 1.4 exercise the web surfaces (`nekt.us/x/{token}`, web sign-up, web scheduling)
