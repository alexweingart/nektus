import type { OpenAIFunction, NavigateToBookingResult } from '@/types/ai-scheduling';

export const navigateToBookingLinkFunction: OpenAIFunction = {
  name: 'navigateToBookingLink',
  description: 'Provide calendar booking link for user to schedule the event',
  parameters: {
    type: 'object',
    properties: {
      confirmationMessage: {
        type: 'string',
        description: 'Message confirming the navigation/booking action',
      },
      buttonText: {
        type: 'string',
        description: 'Text for the booking button',
      },
    },
    required: ['confirmationMessage', 'buttonText'],
  },
};

export function processNavigateToBookingResult(args: string, calendarUrl?: string): NavigateToBookingResult {
  try {
    const parsed = JSON.parse(args);

    return {
      message: parsed.confirmationMessage || 'Here\'s your calendar link to book the event:',
      calendarUrl: calendarUrl || '',
      showCreateButton: true,
    };
  } catch (error) {
    console.error('Error parsing navigateToBooking result:', error);
    throw new Error('Failed to parse navigation result');
  }
}