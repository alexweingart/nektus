# AI Scheduling Refactor - Detailed Implementation Plan

## Phase 1: Completed ✅
- [x] Renamed edit-event.ts → edit-event-template.ts with function name updates
- [x] Updated generate-event.ts to use ranked arrays (4 items)
- [x] Updated all imports and references

## Phase 2: Template Handlers (Current)

### Step 2.1: Create Template Handler Interface

**New file**: `src/lib/ai/scheduling/streaming-handlers/types.ts`

```typescript
import type { Event } from '@/types';
import type { Place } from '@/types/places';

export interface TemplateHandlerResult {
  template: Partial<Event>;
  mode: 'new' | 'edit';
  isConditional?: boolean;
  timePreference?: 'earlier' | 'later' | 'specific';
  previousEvent?: {
    startTime: string;
    endTime: string;
    place?: Place;
  };
  cachedPlaces?: Place[];
  needsPlaceSearch: boolean;
  placeSearchParams?: {
    suggestedPlaceTypes?: string[];
    intentSpecificity?: 'specific_place' | 'activity_type' | 'generic';
    activitySearchQuery?: string;
  };
}
```

### Step 2.2: Complete handleEditEventTemplate

**File**: Already started at `handle-generate-event-template.ts`

**Extract from handle-edit-event.ts lines 32-162**:
- Get cached template/places
- Apply edit result to template
- Handle time buffer adjustments (lines 76-119)
- Handle place type changes (lines 124-156)
- Return TemplateHandlerResult with mode='edit'

**Key Logic to Preserve**:
```typescript
// Time buffer adjustment for explicit times
if (editResult.newPreferredSchedulableHours) {
  const beforeBuffer = eventTemplate.travelBuffer?.beforeMinutes || 0;
  // Adjust hours by subtracting buffer...
}

// Clear hours for relative time searches
if (timePreference === 'earlier' || 'later' && !newHours) {
  eventTemplate.preferredSchedulableHours = undefined;
}

// Search new places if type changed
if (editResult.newPlaceType) {
  places = await searchPlaces({...});
}
```

### Step 2.3: Update Orchestrator to Use Template Handlers

**File**: `orchestrator.ts`

**Current flow** (lines 200-257):
```typescript
// Stage 3: Template Generation
const extraction = await createCompletion({...});
const toolCall = extraction.choices[0].message.tool_calls?.[0];

switch (toolCall.function.name) {
  case 'generateEventTemplate':
    await handleGenerateEvent(toolCall, ...); // Does EVERYTHING
  case 'editEventTemplate':
    await handleEditEvent(toolCall, ...); // Does EVERYTHING
}
```

**New flow**:
```typescript
// Stage 3: Template Generation (extract to separate handlers)
const extraction = await createCompletion({...});
const toolCall = extraction.choices[0].message.tool_calls?.[0];

let templateResult: TemplateHandlerResult;

switch (toolCall.function.name) {
  case 'generateEventTemplate':
    templateResult = await handleGenerateEventTemplate(toolCall);
    break;
  case 'editEventTemplate':
    templateResult = await handleEditEventTemplate(toolCall, body);
    break;
  case 'navigateToBookingLink':
    await handleNavigateBooking(toolCall, body, controller, encoder);
    controller.close();
    return;
}

// Stage 4: Business Logic (NEW - orchestrator coordinates)
enqueueProgress(controller, encoder, 'Finding time and place...');

// Get candidate slots
const { slots, hasNoCommonTime, hasExplicitTimeConflict } = getCandidateSlotsWithFallback(
  availableTimeSlots,
  {
    duration: templateResult.template.duration || 60,
    intent: templateResult.template.intent,
    preferredSchedulableHours: templateResult.template.preferredSchedulableHours,
    preferredSchedulableDates: templateResult.template.preferredSchedulableDates,
    travelBuffer: templateResult.template.travelBuffer,
  },
  body.calendarType
);

// Search places if needed
let places: Place[] = templateResult.cachedPlaces || [];
if (templateResult.needsPlaceSearch && !templateResult.cachedPlaces) {
  enqueueProgress(controller, encoder, 'Researching places...');
  places = await searchPlaces({
    intentResult: {
      intent: 'create_event',
      ...templateResult.placeSearchParams
    },
    userLocations: [body.user1Location, body.user2Location].filter(Boolean),
  });
}

// Determine alternatives to show
const { showAlternativePlaces, showAlternativeTimes, includeConflictWarning } =
  determineAlternativesToShow(templateResult.template, !hasExplicitTimeConflict);

// Stage 5: LLM Selection (NEW - orchestrator decides path)
if (templateResult.isConditional && hasNoCommonTime) {
  // Path A: Conditional with fallback - use provideAlternatives()
  await handleProvideAlternatives(/* ... */);
} else {
  // Path B: Normal or conditional with matches - use generateEvent()
  enqueueProgress(controller, encoder, 'Selecting time and place...');

  const eventCompletion = await createCompletion({
    messages: [...buildTimeSelectionPrompt(slots, places, template)],
    tools: [{ type: 'function', function: generateEventFunction }],
    tool_choice: { type: 'function', function: { name: 'generateEvent' } },
  });

  const eventToolCall = eventCompletion.choices[0].message.tool_calls?.[0];

  // Now call simplified handleGenerateEvent
  await handleGenerateEvent({
    eventToolCall,
    body,
    templateResult,
    candidateSlots: slots,
    places,
    controller,
    encoder,
  });
}
```

## Phase 3: Simplify handleGenerateEvent

**File**: `handle-generate-event.ts`

**Remove** (moves to orchestrator):
- Lines 33-97: Template parsing, title case, suggested events → handleGenerateEventTemplate
- Lines 112-182: Place search → orchestrator Stage 4
- Lines 140-150: Slot optimization → orchestrator Stage 4
- Lines 216-231: LLM call for generateEvent → orchestrator Stage 5
- Lines 303-406: Rationale generation (DELETED - now in message field)

**Keep** (simplified handler):
- Lines 244-298: Personal calendar validation
- Lines 408-492: Calendar event creation, streaming, caching

**New signature**:
```typescript
export async function handleGenerateEvent({
  eventToolCall,
  body,
  templateResult,
  candidateSlots,
  places,
  controller,
  encoder,
}: {
  eventToolCall: OpenAIToolCall;
  body: AISchedulingRequest;
  templateResult: TemplateHandlerResult;
  candidateSlots: TimeSlot[];
  places: Place[];
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
}): Promise<void> {
  const eventResult = processGenerateEventResult(
    eventToolCall.function.arguments,
    candidateSlots,
    places,
    templateResult.template
  );

  // Validate personal calendar constraints (lines 252-298)
  if (body.calendarType === 'personal') {
    // ... existing validation logic
  }

  enqueueProgress(controller, encoder, 'Finalizing event details...');

  // Create calendar event (lines 408-447)
  const { calendar_urls } = createCompleteCalendarEvent({...});

  // Send message from eventResult (which now includes it from LLM)
  controller.enqueue(encoder.encode(
    `data: ${JSON.stringify({ type: 'content', text: eventResult.message })}\n\n`
  ));

  // Send final event
  enqueueEvent(controller, encoder, finalEvent);

  // Cache template and places (lines 484-491)
  await processingStateManager.set(cacheKey, {...}, 1800);
}
```

## Phase 4: Update handle-edit-event.ts

**File**: `handle-edit-event.ts`

**Current**: 336 lines doing template merge + slot generation + LLM call

**After refactor**: Just delegates to orchestrator

**Option A**: Delete file entirely, orchestrator handles routing
**Option B**: Keep as thin wrapper that calls handleEditEventTemplate then orchestrator continues

**Recommendation**: Delete file, orchestrator handles everything via templateResult

## Phase 5: Add provideAlternatives Handler

**New file**: `handle-provide-alternatives.ts`

**Extract from**: `conditional-edit.ts` lines 138-161

```typescript
export async function handleProvideAlternatives({
  candidateSlots,
  places,
  template,
  body,
  controller,
  encoder,
}: {
  candidateSlots: TimeSlot[];
  places: Place[];
  template: Partial<Event>;
  body: AISchedulingRequest;
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
}): Promise<void> {
  // Call LLM to select 3 alternative times
  const selectionCompletion = await createCompletion({
    messages: [...buildAlternativesPrompt(candidateSlots, template)],
    // Returns just message, no event creation
  });

  const message = selectionCompletion.choices[0].message.content;

  // Stream message only (no event)
  controller.enqueue(encoder.encode(
    `data: ${JSON.stringify({ type: 'content', text: message })}\n\n`
  ));
}
```

## Phase 6: Update Types

**File**: `src/types/ai-scheduling.ts`

**Add to GenerateEventResult**:
```typescript
export interface GenerateEventResult {
  // ... existing fields
  message?: string; // NEW: LLM-generated message
}
```

**Update processGenerateEventResult**:
```typescript
export function processGenerateEventResult(...): GenerateEventResult {
  return {
    // ... existing fields
    message: parsed.message, // NEW: extract from LLM response
  };
}
```

## Phase 7: Testing Strategy

### Test 1: New Event Flow
- Input: "Schedule coffee with Alex"
- Verify: Stage 3 → handleGenerateEventTemplate → Stage 4 (slots + places) → Stage 5 (generateEvent) → handleGenerateEvent
- Check: Event created, message includes alternatives

### Test 2: Edit Event Flow (Normal)
- Input: "Change it to lunch"
- Verify: Stage 3 → handleEditEventTemplate → Stage 4 (new place search) → Stage 5 (generateEvent) → handleGenerateEvent
- Check: Event updated, cached places refreshed

### Test 3: Conditional Edit Flow (With Matches)
- Input: "Do I have earlier times?"
- Verify: Stage 3 → handleEditEventTemplate (isConditional=true) → Stage 4 (filtered slots) → Stage 5 (generateEvent) → handleGenerateEvent
- Check: Event created with earlier time

### Test 4: Conditional Edit Flow (Fallback)
- Input: "Do I have earlier times?" (but none available)
- Verify: Stage 3 → handleEditEventTemplate (isConditional=true) → Stage 4 (hasNoCommonTime=true) → Stage 5 (provideAlternatives) → NO event
- Check: Message with 3 alternatives, no event created

## Implementation Order

1. ✅ **Phase 1 complete** - Function renaming and ranked arrays
2. **Create template handler interface** (types.ts)
3. **Complete handleEditEventTemplate** - extract logic from handle-edit-event.ts
4. **Create handleProvideAlternatives** - extract from conditional-edit.ts
5. **Update orchestrator Stage 4** - add slots + places logic
6. **Update orchestrator Stage 5** - add conditional routing + LLM call
7. **Simplify handleGenerateEvent** - remove template/business logic
8. **Update types** - add message field to GenerateEventResult
9. **Delete handle-edit-event.ts** - no longer needed
10. **Test each flow** - verify all 4 test cases pass

## Rollback Plan

If issues arise:
1. Keep old files as `.old` backups
2. Feature flag: `USE_NEW_ORCHESTRATOR` in env
3. Can route to old handlers if flag is false

## Estimated Impact

- **Files created**: 3 (types.ts, handle-edit-event-template.ts, handle-provide-alternatives.ts)
- **Files modified**: 3 (orchestrator.ts, handle-generate-event.ts, generate-event.ts types)
- **Files deleted**: 1 (handle-edit-event.ts)
- **Lines changed**: ~800 lines total
- **Risk**: Medium-High (core flow refactor)
- **Benefit**: Much clearer separation of concerns, easier to maintain
