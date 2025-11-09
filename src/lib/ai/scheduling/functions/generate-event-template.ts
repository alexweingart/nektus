import type { OpenAIFunction } from '@/types/ai-scheduling';
import type { Event } from '@/types';

export const generateEventTemplateFunction: OpenAIFunction = {
  name: 'generateEventTemplate',
  description: 'Create event template with preferences and constraints. REQUIRED: Add travelBuffer for ALL in-person events.',
  parameters: {
    type: 'object',
    properties: {
      eventType: {
        type: 'string',
        enum: ['virtual', 'in-person'],
        description: `Event type - choose based on the activity:
- 'in-person': Default for most activities unless user explicitly says "video", "call", "online", or "remote". Examples: coffee, meals, walks, sports, creative activities (writing, painting), games, etc.
- 'virtual': ONLY if user explicitly requests video/online/remote meeting or if activity is inherently virtual (e.g., "video call")

When in doubt, choose 'in-person' - most social activities benefit from being together physically.`,
      },
      title: {
        type: 'string',
        description: 'Event title - use simple activity name without mentioning the other person (e.g., "Chess", "Tennis", "Coffee", "Lunch"). The person is already mentioned in the message. For generic activities (intent: custom), use "Time together" or "Hangout".',
      },
      description: {
        type: 'string',
        description: 'Event description. For generic activities (intent: custom), use flexible descriptions like "A special time together", "Weekend activity", or "Quality time". Avoid specific activity descriptions unless user mentioned them.',
      },
      duration: {
        type: 'number',
        description: 'Duration in minutes',
      },
      intent: {
        type: 'string',
        description: `Event intent type. Choose based on the activity:
- Use specific intents (coffee, lunch, dinner, drinks) ONLY when user explicitly mentions these activities
- Use work intents (first30m, first1h, quick_sync, deep_dive, live_working_session) ONLY for work calendar
- Use "custom" for ALL leisure/recreation activities (sports, games, shopping, outdoor activities, entertainment, etc.)
- Default to "custom" when unsure`,
        enum: ['first30m', 'first1h', 'coffee', 'lunch', 'dinner', 'drinks', 'quick_sync', 'deep_dive', 'live_working_session', 'custom'],
      },
      explicitUserTimes: {
        type: 'boolean',
        description: 'True if user specified exact times',
      },
      explicitUserPlace: {
        type: 'boolean',
        description: 'True if user specified exact place',
      },
      preferredSchedulableDates: {
        type: 'object',
        description: 'Date range constraints if user specified them',
        properties: {
          startDate: {
            type: 'string',
            format: 'date',
            description: `Start date for availability window (YYYY-MM-DD). REQUIRED when user specifies date constraints. Today is ${new Date().toISOString().split('T')[0]}. When user says a day like "Sunday", calculate the NEXT occurrence of that day (not today if today is that day). Examples: "next week" = start of next week, "Sunday" = next Sunday. Always provide YYYY-MM-DD format.`
          },
          endDate: {
            type: 'string',
            format: 'date',
            description: `End date for availability window (YYYY-MM-DD). REQUIRED when user specifies date constraints. For single days, use same date as startDate. For ranges like "next week", include full 7-day range. Today is ${new Date().toISOString().split('T')[0]}. Always provide YYYY-MM-DD format.`
          },
          description: {
            type: 'string',
            description: 'Human-readable description of the date constraint (e.g., "next week", "the week after this", "in two weeks")'
          }
        }
      },
      preferredSchedulableHours: {
        type: 'object',
        description: `HARD time constraints only. Use this ONLY for:
1. User explicitly specified times (e.g., "in the morning", "after 5pm", "between 2-4pm")
2. Activities with inherent time requirements (e.g., breakfast, lunch, dinner)

DO NOT use for soft preferences or typical activity times. For example:
- ✅ USE: "lunch" → lunch hours, "coffee in the morning" → morning hours, "dinner" → dinner hours
- ❌ DON'T USE: "walk in the park" (no inherent time constraint), "shopping" (no inherent time constraint), "movie" (can be anytime)

If unsure, leave empty and let the LLM choose the best time based on calendar type and event appropriateness.

Format as 24-hour time strings.`,
        properties: {
          monday: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                start: { type: 'string' },
                end: { type: 'string' }
              }
            }
          },
          tuesday: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                start: { type: 'string' },
                end: { type: 'string' }
              }
            }
          },
          wednesday: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                start: { type: 'string' },
                end: { type: 'string' }
              }
            }
          },
          thursday: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                start: { type: 'string' },
                end: { type: 'string' }
              }
            }
          },
          friday: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                start: { type: 'string' },
                end: { type: 'string' }
              }
            }
          },
          saturday: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                start: { type: 'string' },
                end: { type: 'string' }
              }
            }
          },
          sunday: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                start: { type: 'string' },
                end: { type: 'string' }
              }
            }
          },
        },
      },
      searchForPlaces: {
        type: 'boolean',
        description: 'Whether to search for places (for in-person events)',
      },
      placeSearchQuery: {
        type: 'string',
        description: 'Query for place search if needed',
      },
      specificPlaceName: {
        type: 'string',
        description: 'Specific place name if user mentioned one',
      },
      intentSpecificity: {
        type: 'string',
        enum: ['specific_place', 'activity_type', 'generic'],
        description: 'How specific the user\'s request is: specific_place (named venue), activity_type (specific activity like "coffee" or "tennis"), or generic (vague like "do something")',
      },
      activitySearchQuery: {
        type: 'string',
        description: 'Simple search query for Google Places based on the activity (e.g., "coffee", "tennis", "chess"). Use the activity name directly - do not add words like "clubs", "courts", or "shops".',
      },
      suggestedPlaceTypes: {
        type: 'array',
        items: { type: 'string' },
        description: `Foursquare category IDs for this activity. Choose 1-3 most relevant category IDs:

Food/Drink: restaurant=4bf58dd8d48988d1c4941735, cafe=4bf58dd8d48988d16d941735, coffee=4bf58dd8d48988d1e0931735, bar=4bf58dd8d48988d116941735
Outdoor: park=4bf58dd8d48988d163941735, trail=4bf58dd8d48988d159941735, beach=4bf58dd8d48988d1e2941735
Sports/Fitness: gym=4bf58dd8d48988d175941735, tennis_court=4e39a956bd410d7aed40cbc3, athletics_sports=4f4528bc4b90abdf24c9de85, yoga=4bf58dd8d48988d102941735
Culture: museum=4bf58dd8d48988d181941735, tourist_attraction=4bf58dd8d48988d162941735
Other: shopping_mall=4bf58dd8d48988d1fd941735, stadium=4bf58dd8d48988d184941735

Examples:
Coffee → ["4bf58dd8d48988d1e0931735", "4bf58dd8d48988d16d941735"]
Hiking → ["4bf58dd8d48988d159941735", "4bf58dd8d48988d163941735"]
Tennis → ["4e39a956bd410d7aed40cbc3"]
Generic → ["4bf58dd8d48988d162941735"]`,
      },
      travelBuffer: {
        type: 'object',
        description: 'REQUIRED for in-person events. Travel buffer (default 30min before/after). MUST provide for eventType: "in-person"',
        properties: {
          beforeMinutes: {
            type: 'number',
            description: 'Minutes of travel time before the event'
          },
          afterMinutes: {
            type: 'number',
            description: 'Minutes of travel time after the event'
          }
        },
        required: ['beforeMinutes', 'afterMinutes']
      },
      preferMiddleTimeSlot: {
        type: 'boolean',
        description: 'Whether to prefer time slots in the middle of available windows'
      },
    },
    required: ['eventType', 'title', 'duration', 'intent', 'explicitUserTimes', 'explicitUserPlace'],
  },
};

export function processGenerateEventTemplateResult(args: string): Partial<Event> & {
  intentSpecificity?: string;
  activitySearchQuery?: string;
  suggestedPlaceTypes?: string[];
  specificPlaceName?: string;
  placeSearchQuery?: string;
  searchForPlaces?: boolean;
} {
  try {
    const parsed = JSON.parse(args);

    const eventTemplate: Partial<Event> & {
      intentSpecificity?: string;
      activitySearchQuery?: string;
      suggestedPlaceTypes?: string[];
      specificPlaceName?: string;
      placeSearchQuery?: string;
      searchForPlaces?: boolean;
    } = {
      title: parsed.title,
      description: parsed.description,
      duration: parsed.duration,
      eventType: parsed.eventType as 'video' | 'in-person',
      intent: parsed.intent,
      explicitUserTimes: parsed.explicitUserTimes,
      explicitUserPlace: parsed.explicitUserPlace,
    };

    if (parsed.preferredSchedulableHours) {
      eventTemplate.preferredSchedulableHours = parsed.preferredSchedulableHours;
    }

    if (parsed.preferredSchedulableDates) {
      eventTemplate.preferredSchedulableDates = parsed.preferredSchedulableDates;
    }

    if (parsed.travelBuffer) {
      eventTemplate.travelBuffer = parsed.travelBuffer;
    }

    if (parsed.preferMiddleTimeSlot !== undefined) {
      eventTemplate.preferMiddleTimeSlot = parsed.preferMiddleTimeSlot;
    }

    // Add place-related fields
    if (parsed.intentSpecificity) {
      eventTemplate.intentSpecificity = parsed.intentSpecificity;
    }

    if (parsed.activitySearchQuery) {
      eventTemplate.activitySearchQuery = parsed.activitySearchQuery;
    }

    if (parsed.suggestedPlaceTypes) {
      eventTemplate.suggestedPlaceTypes = parsed.suggestedPlaceTypes;
    }

    if (parsed.specificPlaceName) {
      eventTemplate.specificPlaceName = parsed.specificPlaceName;
    }

    if (parsed.placeSearchQuery) {
      eventTemplate.placeSearchQuery = parsed.placeSearchQuery;
    }

    if (parsed.searchForPlaces !== undefined) {
      eventTemplate.searchForPlaces = parsed.searchForPlaces;
    }

    return eventTemplate;
  } catch (_error) {
    console.error('Error parsing generateEventTemplate result:', _error);
    throw new Error('Failed to parse event template');
  }
}

export interface EventTemplateHelperResult {
  eventTemplate: Partial<Event>;
  searchForPlaces: boolean;
  placeSearchQuery?: string;
  specificPlaceName?: string;
}