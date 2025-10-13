import type { OpenAIFunction } from '@/types/ai-scheduling';
import type { SchedulableHours } from '@/types';

export const editEventTemplateFunction: OpenAIFunction = {
  name: 'editEventTemplate',
  description: 'Parse the user\'s edit request to modify an existing event template. Return ONLY the changes requested - the handler will merge them into the cached template.',
  parameters: {
    type: 'object',
    properties: {
      editType: {
        type: 'string',
        enum: ['date', 'time', 'place', 'duration', 'multiple'],
        description: 'What aspect of the event is being changed: date (different day), time (different time of day), place (different venue), duration (longer/shorter), or multiple changes at once',
      },
      isConditional: {
        type: 'boolean',
        description: 'True if user is asking "do I have..." or "can we..." - means check availability first, only modify if available. False for definitive commands like "change it to 3pm". Examples: "do I have any earlier times?" = true, "can we do Monday evening?" = true, "change it to Friday" = false',
      },
      timePreference: {
        type: 'string',
        enum: ['earlier', 'later', 'specific'],
        description: 'For time changes: "earlier" for "do I have earlier times?", "later" for "can we do it later?", "specific" for exact times. Only provide when editType is "time".',
      },
      newPreferredSchedulableDates: {
        type: 'object',
        description: `New date range if user wants to change the day. Only provide if editType includes "date". Today is ${new Date().toISOString().split('T')[0]}. IMPORTANT: When user says "next week" or "the week after", calculate dates RELATIVE TO THE CURRENTLY SCHEDULED EVENT (from conversation history), NOT relative to today. If event is on Oct 11 and user says "next week", that means Oct 18. If they then say "the week after", that means Oct 25.`,
        properties: {
          startDate: {
            type: 'string',
            format: 'date',
            description: `New start date (YYYY-MM-DD). Calculate relative to CURRENTLY SCHEDULED EVENT date from conversation history, not today.`
          },
          endDate: {
            type: 'string',
            format: 'date',
            description: `New end date (YYYY-MM-DD). Calculate relative to CURRENTLY SCHEDULED EVENT date from conversation history, not today.`
          },
          description: {
            type: 'string',
            description: 'Human-readable description (e.g., "Saturday", "next week")'
          }
        }
      },
      newPreferredSchedulableHours: {
        type: 'object',
        description: 'New time windows if user wants a different time of day. Only provide if editType includes "time". IMPORTANT: For explicit times like "12:00 PM", set BOTH start AND end to the SAME time (e.g., {start: "12:00", end: "12:00"}) to indicate exact time request.',
        properties: {
          monday: { type: 'array', items: { type: 'object', properties: { start: { type: 'string', description: 'Start time in HH:MM format. For explicit times, set same as end.' }, end: { type: 'string', description: 'End time in HH:MM format. For explicit times, set same as start.' } } } },
          tuesday: { type: 'array', items: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } } } },
          wednesday: { type: 'array', items: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } } } },
          thursday: { type: 'array', items: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } } } },
          friday: { type: 'array', items: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } } } },
          saturday: { type: 'array', items: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } } } },
          sunday: { type: 'array', items: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } } } },
        },
      },
      newActivitySearchQuery: {
        type: 'string',
        description: 'New activity search query if changing place category (e.g., from "coffee shops" to "restaurants"). Only provide if editType includes "place" AND user wants a different type of venue.',
      },
      newSpecificPlaceName: {
        type: 'string',
        description: 'Specific venue name if user wants to change to an exact place (e.g., "Blue Bottle Coffee"). Only provide if editType includes "place" AND user mentions a specific venue name.',
      },
      newDuration: {
        type: 'number',
        description: 'New duration in minutes if user wants to change how long the event is. Only provide if editType includes "duration".',
      },
    },
    required: ['editType', 'isConditional'],
  },
};

export interface EditEventTemplateResult {
  editType: 'time' | 'date' | 'place' | 'duration' | 'multiple';
  isConditional: boolean;
  timePreference?: 'earlier' | 'later' | 'specific';
  newPreferredSchedulableDates?: {
    startDate: string;
    endDate: string;
    description: string;
  };
  newPreferredSchedulableHours?: Partial<SchedulableHours>;
  newActivitySearchQuery?: string;
  newSpecificPlaceName?: string;
  newDuration?: number;
}

export function processEditEventTemplateResult(args: string): EditEventTemplateResult {
  try {
    const parsed = JSON.parse(args);

    const result: EditEventTemplateResult = {
      editType: parsed.editType,
      isConditional: parsed.isConditional,
    };

    if (parsed.timePreference !== undefined) {
      result.timePreference = parsed.timePreference;
    }

    if (parsed.newPreferredSchedulableDates) {
      // Normalize field names: LLM sometimes returns 'start'/'end' instead of 'startDate'/'endDate'
      const dates = parsed.newPreferredSchedulableDates;
      result.newPreferredSchedulableDates = {
        startDate: dates.startDate || dates.start,
        endDate: dates.endDate || dates.end,
        description: dates.description
      };
    }

    if (parsed.newPreferredSchedulableHours) {
      result.newPreferredSchedulableHours = parsed.newPreferredSchedulableHours;
    }

    if (parsed.newActivitySearchQuery !== undefined) {
      result.newActivitySearchQuery = parsed.newActivitySearchQuery;
    }

    if (parsed.newSpecificPlaceName !== undefined) {
      result.newSpecificPlaceName = parsed.newSpecificPlaceName;
    }

    if (parsed.newDuration !== undefined) {
      result.newDuration = parsed.newDuration;
    }

    return result;
  } catch (_error) {
    console.error('Error parsing editEventTemplate result:', _error);
    throw new Error('Failed to parse edit event template');
  }
}
