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
2. Activities with inherent time requirements (e.g., breakfast 07:00-10:00, lunch 11:00-14:00, dinner 17:00-21:00)

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
        description: 'Google Places API types for this activity (e.g., ["cafe", "restaurant"] for coffee, ["park", "tourist_attraction"] for hiking)',
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