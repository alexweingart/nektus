# AI Scheduling Refactor Specification

**Date**: 2025-10-18
**Status**: Draft
**Goal**: Simplify AI scheduling architecture, reduce code duplication, and reduce LLM calls

---

## Current Problems

### 1. **Code Duplication (~200 lines)**
- `handle-generate-event.ts` (490 lines) and `handle-edit-event.ts` (336 lines) share 60% of code
- Identical logic for:
  - Slot optimization
  - LLM selection of time/place
  - Calendar event creation
  - Streaming to frontend

### 2. **Too Many LLM Calls**
- **New Event**: 3 calls
  1. Intent classification (NANO)
  2. Template generation (MINI)
  3. Time/place selection (MINI)
  4. Rationale generation (MINI)
- **Edit Event**: 4-5 calls
  1. Intent classification (NANO)
  2. Edit request parsing (MINI)
  3. Maybe conditional alternatives (MINI)
  4. Time/place selection (MINI)
  5. Rationale generation (MINI)

### 3. **Inconsistent Architecture**
- Template generation is inline in orchestrator (not a handler)
- Edit has template adjustments in handler, new doesn't
- Handlers call other operations instead of orchestrator coordinating

---

## Proposed Architecture

### **Core Principle**: Clear stage progression with distinct responsibilities

```
orchestrator.ts
│
├─ Stage 1: NANO - Intent classification + acknowledgment
│
├─ Stage 2: Route by intent (show_more, suggest_activities, etc.)
│
├─ Stage 3: MINI - Template generation (handle_event intent only)
│  ├─ LLM call with tools: [generateEventTemplate, editEventTemplate, navigateToBookingLink]
│  ├─ Force generateEventTemplate if conversationHistory.length === 0 (new conversation)
│  │
│  └─ Route based on function returned:
│     │
│     ├─ generateEventTemplate
│     │  → handleGenerateEventTemplate()
│     │     ├─ Parse template
│     │     ├─ Apply title case to event title
│     │     ├─ Check for suggested event from previous search (cache: events:*)
│     │     │  └─ If match found: Override template with event details (venue, address, time)
│     │     └─ Return: { template, mode: 'new', needsPlaceSearch, placeSearchParams }
│     │
│     ├─ editEventTemplate
│     │  → handleEditEventTemplate()
│     │     ├─ Get cached template
│     │     ├─ Apply template adjustments (60 lines of biz logic)
│     │     └─ Return: { template, mode: 'edit', isConditional, timePreference, previousEvent, cachedPlaces, needsPlaceSearch, placeSearchParams }
│     │
│     └─ navigateToBookingLink
│        → handleNavigateBooking() → DONE (no further stages)
│
├─ Stage 4: Business logic (depends on template from Stage 3)
│  ├─ Get candidate slots (always)
│  ├─ Search places (if needsPlaceSearch = true)
│  └─ Determine alternatives to show (call determineAlternativesToShow() → returns flags)
│
└─ Stage 5: LLM selection - MINI (mutually exclusive paths)
   │
   ├─ Path A: IF conditional AND no matching slots
   │  └─ MINI: provideAlternatives() → Stream message → DONE
   │
   └─ Path B: ELSE (normal flow or conditional with matches)
      └─ MINI: generateEvent(select + message) → handleGenerateEvent() → Stream event → DONE
```

---

## Key Design Decisions

### 1. **Five-Stage Pipeline**
- **Stage 1**: Intent classification (NANO)
- **Stage 2**: Route by intent
- **Stage 3**: Template generation (MINI) - handlers return template + metadata
- **Stage 4**: Business logic (slots, places, alternatives flags) - orchestrator coordinates
- **Stage 5**: LLM selection (MINI) - either `generateEvent` OR `provideAlternatives` (mutually exclusive)
  - `provideAlternatives`: ONLY when `isConditional = true` AND `hasNoCommonTime = true` (fallback slots)
  - `generateEvent`: All other cases (normal flow, conditional with matching slots, new events)

Benefits:
- Clear separation of concerns
- Easy to understand flow
- Each stage has single responsibility
- Orchestrator coordinates, handlers are thin

### 2. **Template Handlers Are Thin**
- Parse template, apply adjustments, return metadata
- Don't call LLMs or do heavy business logic
- Return flags to orchestrator: `needsPlaceSearch`, `placeSearchParams`, `isConditional`
- Stage 4 handles ALL business logic (slots, places), not handlers

### 3. **Unified Event Handler: `handle-generate-event.ts`**
- Handles both new and edit events
- Takes finalized template + metadata
- Just creates calendar event and streams
- No LLM calls (orchestrator handles those in Stage 5)

### 4. **Combine Selection + Rationale into One LLM Call with Ranked Arrays**
- Current: 2 calls (select indices, then explain)
- Proposed: 1 call (rank options + generate explanation)
- LLM returns:
  - `rankedSlotIndices: [best, alt1, alt2, alt3]` - 4 ranked time slots (1 best + 3 alternatives)
  - `rankedPlaceIndices: [best, alt1, alt2, alt3]` - 4 ranked places (1 best + 3 alternatives)
  - `message` - composed using ranked arrays + flags from `determineAlternativesToShow()`
- Benefits:
  - LLM is already reasoning about alternatives while selecting best option
  - Separates selection logic from message composition
  - Message uses flags to decide which alternatives to include

### 5. **Conditional Logic Replaces Selection (Mutually Exclusive)**
- Stage 5 calls EITHER `provideAlternatives()` OR `generateEvent()`, never both
- If conditional AND no matching slots → `provideAlternatives()` → stream message → DONE
- If conditional AND slots found → filter slots → `generateEvent()` with filtered slots
- If not conditional → `generateEvent()` with all candidate slots

### 6. **Web Search Removed**
- Web search for events like "What's happening in SF?" is handled by `suggest_activities` intent (Stage 2)
- The `handle_event` flow (Stages 3-5) does NOT do web search
- Generic requests like "Let's do something fun" get routed to `suggest_activities`, not `handle_event`

### 7. **Function File Naming**
- `generate-event-template.ts` - Function definition for new events
- `edit-event-template.ts` - Function definition for edits (renamed from `edit-event.ts`)
- `generate-event.ts` - Function definition for selection (adds `message` field)

---

## Detailed Flow

### **New Event Flow**

```
User: "Let's grab coffee next week"
  ↓
orchestrator.ts - Stage 1: Intent Classification
  ├─ NANO LLM call
  └─ Returns: {intent: 'handle_event', acknowledgment: "Let me find a good time..."}
  ↓
orchestrator.ts - Stage 2: Route by Intent
  └─ Routes to Stage 3 (handle_event)
  ↓
orchestrator.ts - Stage 3: Template Generation
  ├─ MINI LLM call
  │  Tools: [generateEventTemplate, editEventTemplate, navigateToBookingLink]
  │  (Force generateEventTemplate since conversationHistory.length === 0)
  └─ Returns: generateEventTemplate({
       eventType: 'in-person',
       title: 'coffee',  // lowercase from LLM
       duration: 30,
       preferredSchedulableDates: {...},
       suggestedPlaceTypes: ['cafe'],
       intentSpecificity: 'activity_type',
       ...
     })
  ↓
  → handleGenerateEventTemplate()
     ├─ Parse template
     ├─ Apply title case: 'coffee' → 'Coffee'
     ├─ Check cache for suggested events (none found)
     └─ Return: {
          template: {title: 'Coffee', ...},
          mode: 'new',
          needsPlaceSearch: true,
          placeSearchParams: {suggestedPlaceTypes: ['cafe'], intentSpecificity: 'activity_type'}
        }
  ↓
orchestrator.ts - Stage 4: Business Logic
  ├─ Get candidate slots
  │  └─ getCandidateSlotsWithFallback(availableSlots, template)
  │      Returns: {slots, hasNoCommonTime, hasExplicitTimeConflict}
  │
  ├─ Search places (if needsPlaceSearch = true)
  │  └─ searchPlaces({suggestedPlaceTypes: ['cafe'], userLocations})
  │      Returns: [Blue Bottle, Philz, Sightglass]
  │
  └─ Determine what alternatives to show
     └─ determineAlternativesToShow(template, !hasExplicitTimeConflict, undefined)
         Returns: {showAlternativePlaces: true, showAlternativeTimes: false, includeConflictWarning: false}
  ↓
orchestrator.ts - Stage 5: LLM Selection
  ├─ Check: isConditional? No
  │
  └─ MINI LLM call: generateEvent()
     Input:
       - candidate slots (array)
       - places (array)
       - template
       - showAlternativePlaces: true  ← Include place alternatives in message
       - showAlternativeTimes: false  ← Don't include time alternatives
       - includeConflictWarning: false ← No conflict warning needed

     Output: {
       rankedSlotIndices: [2, 5, 8, 11],   // Best slot: #2, alternatives: #5, #8, #11
       rankedPlaceIndices: [0, 1, 4, 2],   // Best place: #0 (Blue Bottle), alternatives: #1 (Philz), #4 (Sightglass), #2 (Ritual)
       message: "I found a great time on Tuesday, October 24 at 2:00 PM at Blue Bottle Coffee.

                 I also considered:
                 - Philz Coffee - closer to midpoint
                 - Sightglass - highly rated local favorite
                 - Ritual Coffee - popular spot with great atmosphere",
       calendarProvider: 'google'
     }

     Note: LLM ranks all options, message uses rankedPlaceIndices[1-3] for alternatives since showAlternativePlaces=true
  ↓
  → handleGenerateEvent()
     ├─ Create calendar event (with selected slot + place)
     ├─ Stream message
     ├─ Stream event
     └─ Done
```

### **Edit Event Flow**

```
User: "Can we do lunch instead?"
  ↓
orchestrator.ts - Stage 1-2: (same as new)
  ↓
orchestrator.ts - Stage 3: Template Generation
  ├─ MINI LLM call (same call as new event)
  │  Tools: [generateEventTemplate, editEventTemplate, navigateToBookingLink]
  └─ Returns: editEventTemplate({
       changeType: 'multiple',
       newDuration: 60,
       newPlaceType: 'restaurant',
       isConditional: false
     })
  ↓
  → handleEditEventTemplate()
     ├─ Get cached template (from Redis)
     ├─ Apply adjustments:
     │  ├─ Merge fields (duration: 60)
     │  └─ Travel buffer math (if time changed)
     └─ Return: {
          template: adjustedTemplate,  // duration: 60, placeType: 'restaurant', etc.
          mode: 'edit',
          isConditional: false,
          previousEvent: {startTime: "...", place: "..."},
          cachedPlaces: [...],  // From cache, may be outdated
          needsPlaceSearch: true,  // placeType changed
          placeSearchParams: {activitySearchQuery: 'restaurant', intentSpecificity: 'activity_type'}
        }
  ↓
orchestrator.ts - Stage 4: Business Logic
  ├─ Get candidate slots
  │  └─ getCandidateSlotsWithFallback(availableSlots, adjustedTemplate)
  │      Returns: {slots, hasNoCommonTime, hasExplicitTimeConflict}
  │
  ├─ Search places (if needsPlaceSearch = true - type changed to restaurants)
  │  └─ searchPlaces({activitySearchQuery: 'restaurant', userLocations})
  │      Returns: [The Grove, Gracias Madre, Foreign Cinema]
  │
  └─ Determine what alternatives to show
     └─ determineAlternativesToShow(template, !hasExplicitTimeConflict, {newPlaceType: 'restaurant'})
         Returns: {showAlternativePlaces: true, showAlternativeTimes: false, includeConflictWarning: false}
         // User changed place → show place alternatives
  ↓
orchestrator.ts - Stage 5: LLM Selection
  ├─ Check: isConditional? No
  │
  └─ MINI LLM call: generateEvent()
     Input:
       - candidate slots
       - places
       - template
       - previousEvent
       - showAlternativePlaces: true
       - showAlternativeTimes: false
       - includeConflictWarning: false
     Output: {
       rankedSlotIndices: [1, 3, 7, 9],
       rankedPlaceIndices: [2, 0, 4, 1],  // Best: The Grove, alts: Gracias Madre, Foreign Cinema, Nopa
       message: "Updated to lunch at The Grove on Thursday at 12:00 PM.

                 I also considered:
                 - Gracias Madre - great Mexican, closer to midpoint
                 - Foreign Cinema - unique atmosphere
                 - Nopa - popular California cuisine",
       calendarProvider: 'google'
     }
  ↓
  → handleGenerateEvent()
     ├─ Create calendar event
     ├─ Stream message
     ├─ Stream event
     └─ Done
```

### **Conditional Edit Flow**

```
User: "Do I have any earlier times?"
  ↓
orchestrator.ts - Stage 1-2: (same as new)
  ↓
orchestrator.ts - Stage 3: Template Generation
  └─ Returns: editEventTemplate({
       changeType: 'time',
       timePreference: 'earlier',
       isConditional: true  ← Key difference
     })
  ↓
  → handleEditEventTemplate()
     ├─ Get cached template
     ├─ Apply adjustments:
     │  └─ Clear schedulable hours (to search ALL times, then filter to earlier)
     └─ Return: {
          template: adjustedTemplate,
          mode: 'edit',
          isConditional: true,  ← Flags conditional
          timePreference: 'earlier',
          previousEvent: {startTime: "2024-10-24T14:00:00Z", ...},
          cachedPlaces: [...],  // Use cached places
          needsPlaceSearch: false  // No place type change
        }
  ↓
orchestrator.ts - Stage 4: Business Logic
  ├─ Get candidate slots
  │  └─ getCandidateSlotsWithFallback(availableSlots, adjustedTemplate)
  │      Returns: {slots: [...all available...], hasNoCommonTime: false, hasExplicitTimeConflict: false}
  │
  └─ Determine what alternatives to show (for matching slots case)
     └─ determineAlternativesToShow(template, !hasExplicitTimeConflict, {timePreference: 'earlier'})
         Returns: {showAlternativePlaces: false, showAlternativeTimes: true, includeConflictWarning: false}
         // User changed time → show time alternatives
         // NOTE: Only used if hasNoCommonTime = false (Path B below)
  ↓
orchestrator.ts - Stage 5: LLM Selection
  ├─ Check: isConditional = true AND hasNoCommonTime = true (fallback slots)
  │  │
  │  └─ Path A: MINI LLM call: provideAlternatives()  ← REPLACES generateEvent()
  │     ├─ LLM selects 3 best alternatives from fallback slots
  │     ├─ Does NOT use determineAlternativesToShow flags (hardcoded message)
  │     └─ Return: {
  │          message: "I checked, but your original time works best for both schedules.
  │
  │                    I also considered these alternative times:
  │                    - **Wednesday at 10:00 AM** (may have conflicts)
  │                    - **Friday at 9:30 AM** (may have conflicts)
  │                    - **Monday at 2:00 PM** (may have conflicts)
  │
  │                    Let me know if you'd like to try one of these instead!"
  │        }
  │     → Stream message → DONE (no event created)
  │
  └─ ELSE: hasNoCommonTime = false (matching slots found - normal flow)
     └─ Path B: Continue to generateEvent() with filtered/matching slots
        ↓
        MINI LLM call: generateEvent()
        Input:
          - filteredSlots (matching 'earlier' preference)
          - places (cached)
          - template
          - previousEvent
          - showAlternativePlaces: false
          - showAlternativeTimes: true  ← Uses flags from Stage 4
          - includeConflictWarning: false
        Output: {
          rankedSlotIndices: [0, 2, 5, 7],  // Best: Tuesday 11am, alts: Monday 10:30am, Wed 9am, Friday 10am
          rankedPlaceIndices: [0, 1, 2, 3],  // Use cached places
          message: "Updated to earlier time: Tuesday at 11:00 AM at Blue Bottle Coffee.

                    I also considered:
                    - **Monday at 10:30 AM** - even earlier option
                    - **Wednesday at 9:00 AM** - start of week
                    - **Friday at 10:00 AM** - end of week morning slot",
          calendarProvider: 'google'
        }
        ↓
        handleGenerateEvent() → Create & stream event
```

---

## File Structure Changes

### **New Files**

**`src/lib/ai/scheduling/streaming-handlers/handle-generate-event-template.ts`**
```typescript
export async function handleGenerateEventTemplate(
  toolCall: OpenAIToolCall,
  body: AISchedulingRequest
): Promise<EventTemplateResult> {
  const template = processGenerateEventTemplateResult(toolCall.function.arguments);

  return {
    template,
    mode: 'new',
    needsPlaceSearch: template.eventType === 'in-person',
    placeSearchParams: template.eventType === 'in-person' ? {
      suggestedPlaceTypes: template.suggestedPlaceTypes,
      intentSpecificity: template.intentSpecificity,
      activitySearchQuery: template.activitySearchQuery
    } : undefined
  };
}
```

**`src/lib/ai/scheduling/streaming-handlers/handle-edit-event-template.ts`**
```typescript
export async function handleEditEventTemplate(
  toolCall: OpenAIToolCall,
  body: AISchedulingRequest
): Promise<EventTemplateResult> {
  const editRequest = processEditEventResult(toolCall.function.arguments);

  // Get cached template
  const cacheKey = `places:${body.user1Id}:${body.user2Id}`;
  const cached = await processingStateManager.getCached(cacheKey);

  if (!cached?.eventTemplate) {
    throw new Error('Cannot edit: no cached template');
  }

  // Apply template adjustments (inline - 60 lines of business logic)
  const adjustedTemplate = { ...cached.eventTemplate };

  // Date changes
  if (editRequest.newPreferredSchedulableDates) {
    adjustedTemplate.preferredSchedulableDates = editRequest.newPreferredSchedulableDates;
  }

  // Time changes with buffer math
  if (editRequest.timePreference === 'earlier' || editRequest.timePreference === 'later') {
    // Clear hours to search all times
    adjustedTemplate.preferredSchedulableHours = undefined;
  }

  if (editRequest.newPreferredSchedulableHours) {
    // Adjust for travel buffer (from handle-edit-event.ts lines 76-119)
    const beforeBuffer = adjustedTemplate.travelBuffer?.beforeMinutes || 0;
    const adjustedHours = {} as Record<string, TimeSlot[]>;

    for (const [day, windows] of Object.entries(editRequest.newPreferredSchedulableHours)) {
      adjustedHours[day] = (windows as TimeSlot[]).map((window: TimeSlot) => {
        const startMinutes = timeToMinutes(window.start) - beforeBuffer;
        let endMinutes = timeToMinutes(window.end) - beforeBuffer;

        // If exact time (start === end), create slot for that specific time
        if (startMinutes === endMinutes) {
          const eventDuration = adjustedTemplate.duration || 60;
          const afterBuffer = adjustedTemplate.travelBuffer?.afterMinutes || 0;
          endMinutes = startMinutes + beforeBuffer + eventDuration + afterBuffer;
        }

        return {
          start: minutesToTime(Math.max(0, startMinutes)),
          end: minutesToTime(endMinutes)
        };
      });
    }

    adjustedTemplate.preferredSchedulableHours = adjustedHours;
  }

  // Duration changes
  if (editRequest.newDuration) {
    adjustedTemplate.duration = editRequest.newDuration;
  }

  // Determine if we need new place search (Stage 4 will handle it)
  const needsPlaceSearch = editRequest.newPlaceType !== undefined;
  const placeSearchParams = needsPlaceSearch ? {
    activitySearchQuery: editRequest.newPlaceType,
    intentSpecificity: 'activity_type' as const
  } : undefined;

  return {
    template: adjustedTemplate,
    mode: 'edit',
    previousEvent: cached.eventResult,
    cachedPlaces: cached.places || [],
    isConditional: editRequest.isConditional,
    timePreference: editRequest.timePreference,
    needsPlaceSearch,
    placeSearchParams
  };
}
```

### **Modified Files**

**`src/lib/ai/scheduling/streaming-handlers/orchestrator.ts`**
- Stage 3 extracts template handling
- Stage 4 calls `determineAlternativesToShow()` and passes flags to Stage 5
- Adds business logic coordination
- Handles conditional vs normal flow
- Routes to handleGenerateEvent() at end

**`src/lib/ai/scheduling/streaming-handlers/handle-generate-event.ts`**
- Becomes unified handler for both new and edit
- Takes finalized template + metadata + ranked selections
- Extracts best slot/place from rankedSlotIndices[0] and rankedPlaceIndices[0]
- Simplified: just create event and stream
- No more parallel operations or LLM calls (orchestrator handles that)

**`src/lib/ai/functions/edit-event.ts`** → **`edit-event-template.ts`**
- **IMPORTANT**: `edit-event-template.ts` already exists - DELETE it first
- Rename `edit-event.ts` → `edit-event-template.ts`
- Update function name from `editEvent` → `editEventTemplate`
- Update parameter name from `changeType` → `editType` to match new file
- Orchestrator must use new function name `editEventTemplate`

**`src/lib/ai/functions/generate-event.ts`**
- Replace `selectedSlotIndex` with `rankedSlotIndices` (array of 4)
- Replace `selectedPlaceIndex` with `rankedPlaceIndices` (array of 4)
- Update `message` field description to reference ranked arrays and flags

---

## Implementation Details

### **SSE Progress Updates**

The orchestrator and handlers send progress updates via Server-Sent Events to show loading states:

**Stage 1-2** (Orchestrator):
- No progress (acknowledgment sent immediately)

**Stage 3** (Orchestrator, before template generation):
- `"Getting schedules..."` - if no slots provided
- `"Thinking..."` - if slots already provided

**Stage 4** (handleGenerateEvent):
- `"Narrowing down times & places..."` - while getting slots, researching places, running determine alternatives to show (everything in stage 4)

**Stage 5** (handleGenerateEvent):
- `"Selecting best time and place..."`

**Format**:
```typescript
controller.enqueue(encoder.encode(
  `data: ${JSON.stringify({ type: 'progress', text: 'Researching places...' })}\n\n`
));
```

### **Error Handling**

**Orchestrator error boundary** (orchestrator.ts:266-275):
- Wraps entire flow in try/catch
- On error: Sends error SSE event with user-friendly message
- Always closes controller gracefully

**Format**:
```typescript
controller.enqueue(encoder.encode(
  `data: ${JSON.stringify({ type: 'error', message: 'Failed to process request' })}\n\n`
));
```

**Handler errors**:
- Handlers throw errors that bubble up to orchestrator
- Orchestrator catches and converts to SSE error event
- Frontend displays error to user

---

## LLM Guidance for Time/Place Selection & Message Generation

**Overview**: Stage 5 combines time/place selection with message generation in a single LLM call (`generateEvent`). The LLM returns:
1. **Ranked time slots** (best choice + 3 alternatives)
2. **Ranked places** (best choice + 3 alternatives, for in-person events)
3. **Message** (composed using the ranked selections + guidance flags)

The orchestrator calls `determineAlternativesToShow()` in Stage 4 to decide which alternatives to include in the message.

### **When to Show Place vs. Time Alternatives**

**Stage 4 determines** what type of alternatives the LLM should include in its message by calling:
```typescript
determineAlternativesToShow(template, hasValidTime, editResult)
```

**Returns flags that control message composition**:
```typescript
{
  showAlternativePlaces: boolean,   // Include place alternatives in message
  showAlternativeTimes: boolean,     // Include time alternatives in message
  includeConflictWarning: boolean,   // Add conflict warning to message
}
```

**Decision logic**:

| Scenario | Show Places | Show Times | Conflict Warning |
|----------|-------------|------------|------------------|
| **Conflict (invalid time)** | ❌ | ✅ | ⚠️ YES |
| **Both date/time AND place specified + valid** | ❌ | ❌ | — |
| **Date/time specified + valid** | ✅ | ❌ | — |
| **Place specified + valid** | ❌ | ✅ | — |
| **Default (neither specified)** | ✅ | ❌ | — |
| **Edit: User changed time/date** | ❌ | ✅ | — |
| **Edit: User changed place** | ✅ | ❌ | — |
| **Edit: User changed BOTH** | ❌ | ❌ | — |

### **Time Selection Criteria**

**Calendar Type Differences**:
- **Personal Calendar** (from handle-generate-event.ts:252-298):
  - Leisure/recreation events (intent === 'custom'): MUST be weekend (Sat/Sun) OR evening (>= 5pm)
  - Coffee/meals (specific food intents): Normal times for that event
  - If LLM selects weekday midday for leisure → Override to first weekend/evening slot

- **Work Calendar**:
  - Weekday midday times are fine
  - No weekend/evening preference

**When there are still multiple options within**:
- Use soonest available day (subject to calendar guidence above)
- Pick best time on that day

**Variety** (from conditional-edit.ts:148):
- Pick times on different days when providing alternatives (within the bounds of the options provided)
- Spread options across week for flexibility

### **Place Selection Criteria**

**Pre-filtered by Foursquare client** (foursquare-client.ts:186-200):
- Already filtered to rating >= 4.0 stars (or unrated)
- Already sorted by rating (highest first)
- Each place includes `distance_from_midpoint_km` field

**LLM Selection Guidance** (from system-prompts.ts:172-175):
- **Prioritize venues closer to midpoint** for convenience (lower `distance_from_midpoint_km` = better)
- **Consider both rating and distance** when choosing
  - Places are pre-sorted by rating, so early indices have better ratings
  - Balance high rating with reasonable distance
- **Ideal range**: Within 3km of midpoint for both users
- First result is often best (highest rated), but check distance
- Use Google Maps links in message

### **Alternatives Selection Criteria**

The LLM **always** returns ranked arrays of time slots and places (best choice + alternatives). The message composition uses the flags from `determineAlternativesToShow()` to decide which alternatives to include.

**Time Slot Rankings**:
- Return array of 4 slot indices: `[bestIndex, alt1Index, alt2Index, alt3Index]`
- **All indices must be distinct** (no duplicates)
- Best slot (index 0) follows Time Selection Criteria above
- Alternative slots (indices 1-3):
  - Must be different from bestIndex
  - Spread across different days for variety
  - Follow calendar type constraints (personal = weekend/evening for leisure)
  - Consider time of day diversity (morning vs evening options)

**Place Rankings** (for in-person events):
- Return array of 4 place indices: `[bestIndex, alt1Index, alt2Index, alt3Index]`
- **All indices must be distinct** (no duplicates)
- Best place (index 0) balances rating + distance to midpoint
- Alternative places (indices 1-3):
  - Must be different from bestIndex
  - **Prefer places open at selected time** (when opening hours available)
  - Different venue types/cuisines when possible
  - Vary distance considerations (some closer, some higher rated)
  - All should be good options (pre-filtered to 4+ stars)

**Message Composition**:
- **If `showAlternativePlaces = true`**: Include alternative places (indices 1-3) in message with brief context
- **If `showAlternativeTimes = true`**: Include alternative times (indices 1-3) in message with brief context
- **If both false**: Don't include alternatives section (user specified everything)
- **If `includeConflictWarning = true`**: Add conflict warning to message

### **Message Format & Content Guidelines**

**Standard format**:
```markdown
I've scheduled **[activity]** for **[day and time]** at [Venue Name](https://maps_url). *I've included 30-minute travel buffers before and after.*

I also considered these options:
- [Alt Place/Time 1] - brief context
- [Alt Place/Time 2] - brief context
- [Alt Place/Time 3] - brief context

When you create the event, [Name] will get an invite from your [personal/work] calendar. Let me know if you'd like to make any changes!
```

**Brief context for PLACES**:
- Cuisine/activity type, distance consideration, rating signal, or unique feature
- Examples: "artisanal coffee, closer to midpoint", "highly rated local spot", "great outdoor seating"

**Brief context for TIMES**:
- Day of week context, time of day, or flexibility signal
- Examples: "earlier weekend option", "evening alternative if Saturday doesn't work", "start of week"

**Conflict warning** (ONLY if `includeConflictWarning = true`):
```markdown
⚠️ **IMPORTANT**: This time conflicts with an existing event in your calendar, but I've scheduled it as requested.
```

### **Examples from codebase**
```
I scheduled **dinner with Al** for **Saturday, 7:00-8:30 PM** at [Z & Y Peking Duck](link).
*I've included 30-minute travel buffers before and after.*

I also considered these options:
- [New Thai Elephant](link) - great Thai cuisine with good reviews
- [Ryoko's Japanese Restaurant & Bar](link) - popular Japanese spot
- **Sunday evening** was also available if Saturday doesn't work
```
- Modified to include rationale in response

```typescript
export const generateEventFunction: OpenAIFunction = {
  name: 'generateEvent',
  description: 'Select optimal time/place and rank alternatives for this event.',
  parameters: {
    type: 'object',
    properties: {
      rankedSlotIndices: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of 4 time slot indices [best, alt1, alt2, alt3] from candidate slots (0-based)',
      },
      rankedPlaceIndices: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of 4 place indices [best, alt1, alt2, alt3] (0-based, for in-person events only)',
      },
      calendarProvider: {
        type: 'string',
        enum: ['google', 'microsoft', 'apple'],
      },
      message: {
        type: 'string',
        description: `Explanation of the scheduled time and place.

COMPOSITION RULES:
- Use rankedSlotIndices[0] for the main time, rankedPlaceIndices[0] for main place
- Include alternatives based on flags:
  - If showAlternativePlaces=true: List rankedPlaceIndices[1-3] with brief context
  - If showAlternativeTimes=true: List rankedSlotIndices[1-3] with brief context
- If includeConflictWarning=true: Add conflict warning
- Format: "[Day], [Date] at [Time]" (e.g., "Tuesday, October 24 at 2:00 PM")
- For in-person: Include venue with Google Maps link
- Keep conversational and helpful
`,
      },
    },
    required: ['rankedSlotIndices', 'calendarProvider', 'message'],
  },
};
```

### **Deleted Files** (eventually)
- `src/lib/ai/scheduling/streaming-handlers/handle-edit-event.ts` (~336 lines)
  - Logic split between:
    - `handle-edit-event-template.ts` (template adjustments)
    - `handle-generate-event.ts` (event generation - shared)

---

## LLM Call Reduction

### Before
| Flow | Calls | Details |
|------|-------|---------|
| **New Event** | 4 | NANO (intent) + MINI (template) + MINI (select) + MINI (rationale) |
| **Edit Event** | 5 | NANO (intent) + MINI (edit) + MINI (select) + MINI (rationale) + maybe MINI (alternatives) |
| **Conditional Edit** | 5-6 | + MINI (conditional alternatives) |

### After
| Flow | Calls | Details |
|------|-------|---------|
| **New Event** | 3 | NANO (intent) + MINI (template) + MINI (select + message) |
| **Edit Event** | 3 | NANO (intent) + MINI (template) + MINI (select + message) |
| **Conditional Edit (returns early)** | 3 | NANO + MINI (template) + MINI (conditional - REPLACES select) |
| **Conditional Edit (continues)** | 4 | NANO + MINI (template) + MINI (conditional filter) + MINI (select) |

**Savings**: -20% to -33% LLM calls

---

## Code Reduction

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **Handler LoC** | 826 (generate: 490 + edit: 336) | ~400 (template handlers + unified) | **-52%** |
| **LLM calls (new)** | 4 | 3 | **-25%** |
| **LLM calls (edit)** | 5 | 3 | **-40%** |
| **Duplicated logic** | ~200 lines | 0 | **-100%** |

---

## Implementation Plan

### **Phase 1: Add Message to Selection** ✅
1. Modify `generate-event.ts` function to include `message` field
2. Update orchestrator to use combined selection
3. Test with existing flows

### **Phase 2: Create Template Handlers**
1. Create `handle-generate-event-template.ts`
2. Create `handle-edit-event-template.ts` (with inline template adjustments)
3. Update orchestrator to call template handlers

### **Phase 3: Unify Event Generation**
1. Refactor `handle-generate-event.ts` to accept both new and edit
2. Move business logic (places, slots) to orchestrator
3. Update conditional logic to replace (not supplement) selection

### **Phase 4: Clean Up**
1. Delete old `handle-edit-event.ts`
2. Rename `edit-event.ts` → `edit-event-template.ts`
3. Update imports across codebase
4. Run full test suite

### **Phase 5: Optimize**
1. Fine-tune prompts for combined selection + message
2. Optimize conditional flow
3. Add metrics/logging

---

## Open Questions

### 1. **Should conditional logic stay in separate file?**
**Options**:
- A: Keep in `conditional-edit.ts` (current)
- B: Move into orchestrator
- C: Move into unified handler

**Recommendation**: Keep separate for now (Option A). It's complex logic and may be refactored later.

### 2. **How to handle rationale variations (places vs times)?**
**RESOLVED**: Use existing `determineAlternativesToShow()` logic (see "LLM Guidance" section above)
- Default: Show place alternatives
- If user specified time/date: Show place alternatives
- If user specified place: Show time alternatives
- If conflict: ALWAYS show time alternatives + warning
- If user edited time in edit request: Show time alternatives
- If user edited place in edit request: Show place alternatives

See comprehensive table in "When to Show Place vs. Time Alternatives" section above.

### 3. **Web search removed from this flow**
**Resolved**: Not needed in `handle_event` flow
- Web search for exploratory queries ("What's happening?", "Let's do something fun") is handled by `suggest_activities` intent
- The `handle_event` flow assumes user has already decided on an activity type
- No web search needed in Stages 3-5

### 4. **Cache strategy for templates**
**Purpose**: Enable edits without re-searching places or re-generating templates

**Cache key**: `places:${user1Id}:${user2Id}`

**Contents**:
```typescript
{
  eventTemplate: Partial<Event>,  // Template from previous event
  places: Place[],                 // Places found in previous search
  eventResult: {                   // Result from previous event
    startTime: string,
    endTime: string,
    place?: Place
  },
  timestamp: number
}
```

**TTL**: 30 minutes (1800 seconds)

**When cached**: At end of handleGenerateEvent() after successful event creation

**When used**: In handleEditEventTemplate() to avoid re-searching places if place type hasn't changed

---

## Success Criteria

- ✅ Reduced LLM calls by 25-40%
- ✅ Reduced handler code by 50%+
- ✅ No duplicated logic between new and edit
- ✅ Clearer separation of concerns (orchestrator coordinates, handlers are thin)
- ✅ Rationale always included, varies appropriately
- ✅ Conditional flow simplified (replaces selection, not supplements)
- ✅ All existing features work (new, edit, conditional, alternatives)
- ✅ Tests pass
- ✅ Performance maintained or improved

---

## Notes for Implementation

- Start with Phase 1 to validate combined selection + message works well
- Test thoroughly at each phase before proceeding
- Keep old code until new code is fully tested
- Add feature flag if needed for gradual rollout
- Monitor LLM response quality (selection + message should be coherent)
