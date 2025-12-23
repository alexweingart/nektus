import type { Event } from '@/types';

/**
 * Formatting utilities for AI scheduling LLM prompts
 * These functions build detailed instructions for the LLM to format responses correctly
 */

/**
 * Build formatting instructions for Stage 5 LLM - Event Generation (Path B)
 * Contains decomposed time/place data for selective formatting and rationale generation
 */
export function buildFormattingInstructions(
  timeData: Array<{
    dayLabel: string;
    dateContext: string;
    time: string;
    isTomorrowOrToday: boolean;
  }>,
  placeData: Array<{
    name: string;
    url: string;
    rating?: number;
    distance_miles?: number;
    price_level?: number;
    open_now?: boolean;
    description?: string;
    tips?: string[];
    explanations: string[];
  }>,
  template: Partial<Event>,
  showAlternativePlaces: boolean,
  showAlternativeTimes: boolean,
  includeConflictWarning: boolean,
  user2Name: string,
  calendarType: string,
  locationContext: 'your_location' | 'other_person_location' | 'midpoint',
  otherPersonName?: string,
  conflictContext?: { requestedTime: string; requestedTimeIndex: number },
  explicitPlaceRequest?: string
): string {
  // Build time data display
  const timeDataDisplay = timeData.map((t, i) =>
    `Slot ${i}:\n  dayLabel: "${t.dayLabel}"\n  dateContext: "${t.dateContext}"\n  time: "${t.time}"\n  isTomorrowOrToday: ${t.isTomorrowOrToday}`
  ).join('\n\n');

  // Build place data display
  const placeDataDisplay = placeData.map((p, i) =>
    `Place ${i}:\n  name: "${p.name}"\n  url: "${p.url}"\n  rating: ${p.rating || 'N/A'}\n  distance_miles: ${p.distance_miles?.toFixed(1) || 'N/A'}${p.description ? `\n  description: "${p.description}"` : ''}${p.tips && p.tips.length > 0 ? `\n  reviews: ${p.tips.slice(0, 3).map(t => `"${t}"`).join(', ')}` : ''}\n  explanations: ${p.explanations.join(', ') || 'none'}`
  ).join('\n\n');

  return `## AVAILABLE DATA

TIME DATA:
${timeDataDisplay}

${placeData.length > 0 ? `PLACE DATA:
${placeDataDisplay}
` : ''}

${explicitPlaceRequest ? `## CRITICAL: USER'S EXPLICIT PLACE REQUEST

The user EXPLICITLY requested this specific venue: "${explicitPlaceRequest}"

PLACE SELECTION REQUIREMENT:
- You MUST select the place from PLACE DATA that BEST MATCHES "${explicitPlaceRequest}"
- Match by name similarity - look for places containing "${explicitPlaceRequest}" or variations
- DO NOT substitute with a different venue, even if you think another option is better
- DO NOT prioritize distance, rating, or other factors over matching the requested name
- If multiple places match, choose the best match based on name relevance

` : ''}

## MESSAGE FORMAT

**FIRST PARAGRAPH** (main event announcement with rationale):

CRITICAL URL INSTRUCTIONS:
- URLs are provided in the PLACE DATA section above
- Each place has a "url" field - this is the COMPLETE Google Maps URL
- Copy the ENTIRE URL exactly as shown - it starts with "https://www.google.com/maps/search/?api=1&query="
- DO NOT shorten URLs
- DO NOT create goo.gl short links
- DO NOT make up URLs
- Example: If the url is "https://www.google.com/maps/search/?api=1&query=Tennis+Court+37.7749%2C-122.4194", use that EXACT string

If isTomorrowOrToday is true:
"I've scheduled **${template.title}** at [place-name-from-data](exact-complete-url-from-place-data) for **{dayLabel}** ({dateContext}) at **{time}**. {rationale}."

If isTomorrowOrToday is false:
"I've scheduled **${template.title}** at [place-name-from-data](exact-complete-url-from-place-data) for **{dayLabel}**, {dateContext} at **{time}**. {rationale}."

FORMATTING RULES:
- Bold ONLY: event name ("${template.title}"), day label, and time
- Hyperlink ONLY: place name - use markdown format [name](COMPLETE_URL_FROM_PLACE_DATA)
- Everything else: plain text

RATIONALE (one sentence explaining your choice):

${conflictContext ? `
CONFLICT-SPECIFIC INSTRUCTIONS:
- You MUST select Slot ${conflictContext.requestedTimeIndex} (the user's explicitly requested time)
- Time selection: You selected this time per the user's explicit request. Mention that it either conflicts with an existing event OR is outside the schedulable hours for at least one person.
- Place factors: REQUIRED - Focus your rationale on WHY you picked this specific venue using your real-world knowledge about this venue's features, reputation, or characteristics.
- Alternative times: REQUIRED - Show the other available time slots as alternatives (Slot 1, Slot 2, Slot 3, etc.) in the ALTERNATIVES SECTION. These are times that don't conflict.
- Distance display: Use miles as provided in distance_miles field (already converted, rounded to 1 decimal place). ${
    locationContext === 'your_location' ? 'Say "X miles from your location"' :
    locationContext === 'other_person_location' ? `Say "X miles from ${otherPersonName}'s location"` :
    'Say "X miles from the midpoint"'
  }
- Example: "I picked this time per your request, though it does conflict with an existing event or is outside the schedulable hours for at least one of you. I chose [venue] because [specific venue knowledge and why it's good for this activity]."
` : `
NORMAL INSTRUCTIONS:
- Day/Time factors: Explain WHY you chose this specific day and time based on the activity type (e.g., afternoon vs morning, weekday vs weekend, avoiding rush hours). Only use "soonest available" if it's truly the first possible slot across all days.
- Place factors: REQUIRED - Use your real-world knowledge about this specific venue to explain what makes it good for this activity. Think about the venue's actual features, reputation, or characteristics. Do NOT fall back to generic location descriptions.
- Distance display: Use miles as provided in distance_miles field (already converted, rounded to 1 decimal place). ${
    locationContext === 'your_location' ? 'Say "X miles from your location"' :
    locationContext === 'other_person_location' ? `Say "X miles from ${otherPersonName}'s location"` :
    'Say "X miles from the midpoint"'
  }
`}

${template.travelBuffer ? `
**SECOND PARAGRAPH** (blank line, then travel buffer):

I've included ${template.travelBuffer.beforeMinutes || 30}-minute travel buffers before and after.

(blank line)
` : ''}
${showAlternativePlaces || showAlternativeTimes ? `
**ALTERNATIVES SECTION**:

"I also considered these options:"

${showAlternativePlaces ? `List Place 1, Place 2, Place 3 as BULLETED items:
- [place-name](COMPLETE_URL_FROM_PLACE_DATA). {description of venue} ({distance in miles})
- [place-name](COMPLETE_URL_FROM_PLACE_DATA). {description of venue} ({distance in miles})
- [place-name](COMPLETE_URL_FROM_PLACE_DATA). {description of venue} ({distance in miles})

Instructions for alternative venues:
- Use your real-world knowledge about each venue to write a brief (5-10 word) description/rationale
- Focus on what makes each venue unique or notable for this activity
- Distance is already in miles in the distance_miles field - display as "0.5 miles" format in parentheses
- Start description with capital letter (it follows a dash)
- Do NOT use generic phrases like "convenient location"
- CRITICAL: Use the COMPLETE url value from PLACE DATA for each alternative place. The URLs are long - that's correct. Do NOT shorten them.` : ''}
${showAlternativeTimes ? `List Slot 1, Slot 2, Slot 3 as BULLETED items using this format:
- **{dayLabel}**, {dateContext} at **{time}**. Brief context about why this time could work

Example: "- **Saturday**, Nov 16 at **6:30 PM**. Ideal dinner time on a weekend night, where both of you are available."
` : ''}

(blank line)
` : ''}
${includeConflictWarning ? `
**CONFLICT WARNING**:

⚠️ **IMPORTANT**: This time conflicts with an existing event in your calendar, but I've scheduled it as requested.

` : ''}
**FINAL PARAGRAPH**:

"When you create the event, ${user2Name || 'they'}'ll get an invite from your **${calendarType}** calendar. Let me know if you'd like to make any changes!"`;
}

/**
 * Build formatting instructions for Stage 5 LLM - Alternatives (Path A)
 * Contains exact pre-formatted strings for alternatives message
 */
export function buildAlternativesFormattingInstructions(
  currentTimeString: string,
  alternativeTimeStrings: string[],
  requestDescription: string,
  reason: 'conflicts' | 'no_availability',
  hasWiderSearch: boolean,
  searchContext: string
): string {
  return `EXACT STRINGS TO USE:

CURRENT TIME (the time user wanted):
"${currentTimeString}"

ALTERNATIVE TIME OPTIONS (copy exactly for selected indices):
${alternativeTimeStrings.map((t, i) => `Option ${i}: "${t}"`).join('\n')}

REQUIRED MESSAGE FORMAT:
1. Explain the situation: "I checked, but ${requestDescription} ${reason === 'no_availability' ? 'has no availability' : 'conflicts with existing events'}. Here are your options:"

2. Present current time option: "**Keep original time:** [copy CURRENT TIME string from above]"

3. ${alternativeTimeStrings.length > 0 ? `Present alternatives: "**Available alternatives${hasWiderSearch ? ` in ${searchContext}` : ''}:**"
   - List your 3 selected options using their exact strings
   - Number them 1, 2, 3
   - Use the exact Option X strings from above` : 'If no alternatives: "Unfortunately, I couldn\'t find any other available times."'}

4. ${alternativeTimeStrings.length > 0 ? 'Close with: "Let me know which option works best!"' : 'Close with a helpful suggestion or question'}

CRITICAL RULES:
- Copy time strings EXACTLY character-for-character
- Do NOT modify or reformat the time strings
- Be warm and conversational in your message
- Keep formatting clean with proper line breaks and bold text`;
}
