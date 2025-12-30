# Contact Save Flow Specification

This document describes the expected behavior for saving contacts across different platforms.

## Platform Categories

1. **Android** - Android devices
2. **iOS Embedded** - iOS in-app browsers (Instagram, Facebook, LINE, Twitter, etc.)
3. **iOS Non-Embedded** - iOS Safari, Chrome, Edge, Firefox

## State Variables

### Per-Contact State (localStorage: `exchange_state_{token}`)
- `state`: 'pending' | 'auth_in_progress' | 'completed_success' | 'completed_firebase_only'
- `platform`: 'android' | 'ios' | 'web'
- `profileId`: string
- `timestamp`: number
- `upsellShown`: boolean

### Global State (localStorage)
- `google_contacts_upsell_dismissed`: 'true' | null (iOS non-embedded only)
- `google_contacts_first_save_completed`: 'true' | null (iOS non-embedded only)

### Runtime State
- `likelyHasPermission`: boolean - Whether user likely has Google Contacts permission
- `shouldShowUpsell`: boolean - Whether to show upsell modal

## Initial State (First Contact Save Ever)

### All Platforms:
- No exchange state exists
- `likelyHasPermission = false`
- `shouldShowUpsell = true`

### iOS Non-Embedded Only:
- `google_contacts_first_save_completed` not set

## Android & iOS Embedded Behavior

### Flow (Same for First-Time and Subsequent Saves):

1. **Firebase Save**: Kicks off immediately in background (non-blocking)

2. **Permission Check**:
   - If `likelyHasPermission = false`: → **Fast Path** (redirect to Google auth)
   - If `likelyHasPermission = true`: → **Optimistic Save** (attempt Google save)

3. **Fast Path** (when `likelyHasPermission = false`):
   - Set exchange state to `auth_in_progress`
   - Redirect to Google OAuth for contacts permission
   - Wait for callback

4. **Optimistic Save** (when `likelyHasPermission = true`):
   - Attempt Google Contacts API save
   - If success: Show success modal
   - If permission error: Update `likelyHasPermission = false`, redirect to auth

5. **After Auth Callback**:
   - **Success**:
     - Set `likelyHasPermission = true`
     - Set `shouldShowUpsell = false`
     - Attempt Google Contacts save
     - Show success modal
   - **Denied**:
     - Set `likelyHasPermission = false`
     - Set `shouldShowUpsell = true`
     - Show upsell modal

## iOS Non-Embedded Behavior

### First-Time Save (When `google_contacts_first_save_completed` Not Set):

1. **vCard Display**: Show vCard FIRST (before Firebase save)
2. **Firebase Save**: Kicks off in background after vCard dismissed
3. **Permission Check**: Same as Android (fast path if no permission)
4. **Auth Flow**: Redirect to Google OAuth if needed
5. **After Auth**:
   - Success: Show success modal
   - Denied: Show upsell modal (once ever, tracked by `google_contacts_upsell_dismissed`)
6. **Mark Complete**: Set `google_contacts_first_save_completed = true`

### Subsequent Saves (When `google_contacts_first_save_completed` Is Set):

1. **vCard Display**: Show vCard FIRST (before Firebase save)
2. **Firebase Save**: Kicks off in background after vCard dismissed
3. **Google Save**: Attempt in background (if `likelyHasPermission = true`)
4. **Modal**: Always show success modal (never upsell, never redirect to auth)

**Key Differences from Android:**
- ✅ vCard always shows first
- ✅ Subsequent saves never redirect to auth
- ✅ Subsequent saves never show upsell modal
- ✅ Only first-time save can request permissions

## State Transitions

### `likelyHasPermission` Logic:
```
First contact save: false
After successful Google save: true
After permission error: false
After auth success: true
After auth denied: false
```

### `shouldShowUpsell` Logic:
```
No exchange state: true
Exchange state = 'completed_success': false
Exchange state = 'completed_firebase_only':
  - iOS non-embedded: Check global dismissed flag
  - Other platforms: true
```

### iOS Non-Embedded Only - `google_contacts_first_save_completed`:
```
Not set: First-time save (can request auth)
Set to 'true': Subsequent save (no auth, no upsell)
```

## Modals

### Success Modal ("Contact Saved! 🎉")
**When to show:**
- Android/iOS Embedded: After successful Google save OR after successful auth
- iOS Non-Embedded: After successful Google save OR after successful auth (first-time only) OR on any subsequent save

**Actions:**
- "Say hi 👋" - Opens messaging app
- "Nah, they'll text me" - Dismisses modal

### Upsell Modal ("Save to Google Contacts?")
**When to show:**
- Android/iOS Embedded: When Google save fails (no permission) OR after auth denied
- iOS Non-Embedded: After auth denied on first-time save only (once ever)

**Actions:**
- "Yes!" - Redirects to Google OAuth (Android/iOS Embedded only)
- "Nah, just Nekt is fine" - Dismisses modal, marks upsell dismissed (iOS non-embedded: global flag)

## Error Handling

### Permission Errors (403, 401, "insufficient permission", etc.):
- Update `likelyHasPermission = false`
- Android/iOS Embedded: Redirect to auth
- iOS Non-Embedded First-time: Redirect to auth
- iOS Non-Embedded Subsequent: Silent failure, show success modal anyway

### Network Errors:
- Firebase save failure: Return error, don't proceed
- Google save failure: Save to Firebase only, set state to `completed_firebase_only`

### Auth Cancellation (User taps back):
- Treat as denied
- Show upsell modal (if applicable per platform rules)

## State Expiration

### Exchange State:
- `auth_in_progress`: 5 minutes
- `completed_success` / `completed_firebase_only`:
  - iOS (all): Never expires (persists forever)
  - Android/Other: 15 minutes

### Global Flags (iOS Non-Embedded):
- Never expire (persist forever)
