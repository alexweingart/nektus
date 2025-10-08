# CalConnect → Nekt Merge Plans

## Directory Organization Strategy

We're using a **hybrid approach**:
- **Nekt's service pattern** for core features (profiles, contacts) - organized by client/server
- **CalConnect's domain pattern** for scheduling features - organized by functional area

### Final Structure

```
/lib
  /services
    /client              ← Nekt pattern: Client-side business logic
      - calendarStateService.ts       (CalConnect UI state management)
      - profileSaveService.ts         (Nekt existing)
      - contactSaveService.ts         (Nekt existing)
    /server              ← Nekt pattern: Server-side business logic  
      - aiProcessingService.ts        (CalConnect AI state tracking)
      - bioAndSocialGenerationService.ts  (Nekt existing)
  
  /calendar-providers    ← CalConnect domain: OAuth & calendar APIs
  /location              ← CalConnect domain: Geolocation & validation
  /places                ← CalConnect domain: Foursquare place search
  /events                ← CalConnect domain: Event templates & scheduling
  /ics-parsing           ← CalConnect domain: ICS feed parsing
  
  /ai
    /scheduling          ← CalConnect: AI scheduling (will merge with Nekt OpenAI in Phase 8)
      /functions
      /helpers  
      /streaming-handlers
  
  /firebase              ← Nekt existing (will merge CalConnect DB helpers in Phases 3-4)
  /openai                ← Nekt existing (will merge with /ai/scheduling in Phase 8)
  /utils                 ← Nekt existing
  constants.ts
```

---

## Firebase Merge Plan

**Strategy:** Merge gradually across phases, only adding what's needed per phase.

### Current State
- **Nekt:** `/lib/firebase/` with profile/auth helpers
- **CalConnect:** Has calendar/location DB helpers we need

### Phase-by-Phase Merge

#### Phase 3: Edit Profile - Calendar
**Add to Nekt's Firebase:**
- Calendar CRUD operations (from CalConnect's `firebase-db.ts`)
- Calendar token management (from CalConnect's `firebase-admin-db.ts`)
- Functions to merge:
  - `addCalendar()` → Add to `clientProfileService.ts`
  - `updateCalendar()` → Add to `clientProfileService.ts`
  - `deleteCalendar()` → Add to `clientProfileService.ts`
  - `getCalendarTokens()` → Add to `adminProfileService.ts`
  - `updateCalendarTokens()` → Add to `adminProfileService.ts`

#### Phase 4: Edit Profile - Location  
**Add to Nekt's Firebase:**
- Location CRUD operations
- Functions to merge:
  - `addLocation()` → Add to `clientProfileService.ts`
  - `updateLocation()` → Add to `clientProfileService.ts`
  - `deleteLocation()` → Add to `clientProfileService.ts`

#### Phase 8: AI Schedule
**Add to Nekt's Firebase:**
- Event CRUD operations (if needed)
- AI processing state tracking

### Files to Reference
- **CalConnect Client DB:** `/calconnect/src/lib/firebase/firebase-db.ts`
- **CalConnect Admin DB:** `/calconnect/src/lib/firebase/firebase-admin-db.ts`
- **Nekt Client Profile:** `/nektus/src/lib/firebase/clientProfileService.ts`
- **Nekt Admin Profile:** `/nektus/src/lib/firebase/adminProfileService.ts`

---

## OpenAI Merge Plan

**Strategy:** Merge in Phase 8 when implementing AI Schedule page.

### Current State
- **Nekt:** `/lib/openai/` - Bio & social generation
- **CalConnect:** `/lib/ai/scheduling/` - Streaming AI scheduler

### Phase 8: Merge Strategy

#### 1. Keep Nekt's Existing OpenAI Client
**Location:** `/lib/openai/client.ts` (or similar)
**Purpose:** Bio generation, social profile discovery
**Keep As-Is:** ✅

#### 2. Integrate CalConnect's Streaming Functions
**Merge Into:** `/lib/openai/` or create `/lib/openai/scheduling/`

**Files to integrate:**
- `/ai/scheduling/functions/` → OpenAI function definitions for scheduling
- `/ai/scheduling/streaming-handlers/` → SSE streaming handlers  
- `/ai/scheduling/system-prompts.ts` → Scheduling-specific prompts

#### 3. Unified OpenAI Client Structure (Phase 8)

```
/lib/openai
  - client.ts                    (Unified OpenAI client)
  /bio                           (Nekt existing)
    - bioGeneration.ts
    - socialDiscovery.ts
  /scheduling                    (CalConnect merged)
    /functions                   (OpenAI function definitions)
    /streaming-handlers          (SSE handlers)
    - systemPrompts.ts
```

**Benefits:**
- Single OpenAI client for both bio generation and scheduling
- Shared configuration (API keys, model settings)
- Reusable streaming infrastructure
- Clear separation of concerns by feature

### Implementation Checklist (Phase 8)
- [ ] Create unified OpenAI client that supports streaming
- [ ] Migrate Nekt's bio generation to use unified client
- [ ] Integrate CalConnect's scheduling functions
- [ ] Test both bio generation and AI scheduling work
- [ ] Update environment variables if needed

---

## Why This Organization?

### Benefits of Hybrid Approach

1. **CalConnect Features Stay Cohesive**
   - All calendar code in `/calendar-providers/`
   - All scheduling logic in `/events/`
   - All place search in `/places/`
   - Easy to find and maintain

2. **Nekt's Service Pattern Continues**
   - Core profile/contact features use familiar pattern
   - Clear client/server separation for existing code
   - No disruption to existing architecture

3. **Best of Both Worlds**
   - Domain-oriented for scheduling (new, distinct feature)
   - Service-oriented for profiles/contacts (existing, core features)
   - Clear boundaries between Nekt code and CalConnect code

4. **Easy Maintenance**
   - Related code grouped together
   - Import paths are intuitive
   - Can update scheduling features independently
