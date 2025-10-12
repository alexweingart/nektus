import type { Event } from '@/types';

// Predefined event templates for quick scheduling
export const eventTemplates: Event[] = [
  {
    id: 'video-30',
    organizerId: '',
    title: 'Video Call',
    duration: 30,
    eventType: 'video',
    intent: 'first30m',
    description: 'Quick video sync',
    preferredSchedulableHours: {
      monday: [{ start: '08:00', end: '22:00' }],
      tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [{ start: '08:00', end: '22:00' }],
      thursday: [{ start: '08:00', end: '22:00' }],
      friday: [{ start: '08:00', end: '22:00' }],
      saturday: [{ start: '08:00', end: '22:00' }],
      sunday: [{ start: '08:00', end: '22:00' }],
    },
    preferMiddleTimeSlot: true,
    status: 'template',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'video-60',
    organizerId: '',
    title: 'Video Call',
    duration: 60,
    eventType: 'video',
    intent: 'first1h',
    description: 'Extended video discussion',
    preferredSchedulableHours: {
      monday: [{ start: '08:00', end: '22:00' }],
      tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [{ start: '08:00', end: '22:00' }],
      thursday: [{ start: '08:00', end: '22:00' }],
      friday: [{ start: '08:00', end: '22:00' }],
      saturday: [{ start: '08:00', end: '22:00' }],
      sunday: [{ start: '08:00', end: '22:00' }],
    },
    status: 'template',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'coffee-30',
    organizerId: '',
    title: 'Coffee',
    duration: 30,
    eventType: 'in-person',
    intent: 'coffee',
    description: 'Casual coffee meetup',
    travelBuffer: { beforeMinutes: 30, afterMinutes: 30 },
    preferredSchedulableHours: {
      monday: [{ start: '08:00', end: '12:00' }],
      tuesday: [{ start: '08:00', end: '12:00' }],
      wednesday: [{ start: '08:00', end: '12:00' }],
      thursday: [{ start: '08:00', end: '12:00' }],
      friday: [{ start: '08:00', end: '12:00' }],
      saturday: [{ start: '08:00', end: '12:00' }],
      sunday: [{ start: '08:00', end: '12:00' }],
    },
    preferMiddleTimeSlot: true,
    status: 'template',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'lunch-60',
    organizerId: '',
    title: 'Lunch',
    duration: 60,
    eventType: 'in-person',
    intent: 'lunch',
    description: 'Lunch meeting',
    travelBuffer: { beforeMinutes: 30, afterMinutes: 30 },
    preferredSchedulableHours: {
      monday: [{ start: '11:30', end: '14:30' }],
      tuesday: [{ start: '11:30', end: '14:30' }],
      wednesday: [{ start: '11:30', end: '14:30' }],
      thursday: [{ start: '11:30', end: '14:30' }],
      friday: [{ start: '11:30', end: '14:30' }],
      saturday: [{ start: '11:30', end: '14:30' }],
      sunday: [{ start: '11:30', end: '14:30' }],
    },
    preferMiddleTimeSlot: true,
    status: 'template',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'dinner-60',
    organizerId: '',
    title: 'Dinner',
    duration: 60,
    eventType: 'in-person',
    intent: 'dinner',
    description: 'Dinner meeting',
    travelBuffer: { beforeMinutes: 30, afterMinutes: 30 },
    preferredSchedulableHours: {
      monday: [{ start: '17:00', end: '20:00' }],
      tuesday: [{ start: '17:00', end: '20:00' }],
      wednesday: [{ start: '17:00', end: '20:00' }],
      thursday: [{ start: '17:00', end: '20:00' }],
      friday: [{ start: '17:00', end: '20:00' }],
      saturday: [{ start: '17:00', end: '20:00' }],
      sunday: [{ start: '17:00', end: '20:00' }],
    },
    preferMiddleTimeSlot: true,
    status: 'template',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'drinks-60',
    organizerId: '',
    title: 'Drinks',
    duration: 60,
    eventType: 'in-person',
    intent: 'drinks',
    description: 'Casual drinks meetup',
    travelBuffer: { beforeMinutes: 30, afterMinutes: 30 },
    preferredSchedulableHours: {
      monday: [{ start: '16:00', end: '18:00' }],
      tuesday: [{ start: '16:00', end: '18:00' }],
      wednesday: [{ start: '16:00', end: '18:00' }],
      thursday: [{ start: '16:00', end: '18:00' }],
      friday: [{ start: '16:00', end: '22:00' }],
      saturday: [{ start: '16:00', end: '22:00' }],
      sunday: [{ start: '16:00', end: '18:00' }],
    },
    preferMiddleTimeSlot: true,
    status: 'template',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'quick-sync-30',
    organizerId: '',
    title: 'Quick Sync',
    duration: 30,
    eventType: 'video',
    intent: 'quick_sync',
    description: 'Quick video sync',
    preferredSchedulableHours: {
      monday: [{ start: '08:00', end: '22:00' }],
      tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [{ start: '08:00', end: '22:00' }],
      thursday: [{ start: '08:00', end: '22:00' }],
      friday: [{ start: '08:00', end: '22:00' }],
      saturday: [{ start: '08:00', end: '22:00' }],
      sunday: [{ start: '08:00', end: '22:00' }],
    },
    status: 'template',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'deep-dive-60',
    organizerId: '',
    title: 'Deep Dive',
    duration: 60,
    eventType: 'video',
    intent: 'deep_dive',
    description: 'Extended video discussion',
    preferredSchedulableHours: {
      monday: [{ start: '08:00', end: '22:00' }],
      tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [{ start: '08:00', end: '22:00' }],
      thursday: [{ start: '08:00', end: '22:00' }],
      friday: [{ start: '08:00', end: '22:00' }],
      saturday: [{ start: '08:00', end: '22:00' }],
      sunday: [{ start: '08:00', end: '22:00' }],
    },
    status: 'template',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'live-working-session-60',
    organizerId: '',
    title: 'Live Working Session',
    duration: 60,
    eventType: 'in-person',
    intent: 'live_working_session',
    description: 'Live working session at a cafe',
    travelBuffer: { beforeMinutes: 30, afterMinutes: 30 },
    preferredSchedulableHours: {
      monday: [{ start: '08:00', end: '22:00' }],
      tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [{ start: '08:00', end: '22:00' }],
      thursday: [{ start: '08:00', end: '22:00' }],
      friday: [{ start: '08:00', end: '22:00' }],
      saturday: [{ start: '08:00', end: '22:00' }],
      sunday: [{ start: '08:00', end: '22:00' }],
    },
    status: 'template',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Helper functions for working with event templates
export const getEventTemplate = (templateId: string): Event | undefined => {
  return eventTemplates.find(t => t.id === templateId);
};

export const getEventTemplateByIntent = (intent: string): Event | undefined => {
  return eventTemplates.find(t => t.intent === intent);
};

// Get default travel buffer based on event type
export const getDefaultTravelBuffer = (eventType: 'video' | 'in-person') => {
  if (eventType === 'in-person') {
    return {
      beforeMinutes: 30,
      afterMinutes: 30
    };
  }
  return undefined;
};

// Calculate total duration including travel buffers
export const calculateTotalDuration = (
  baseDuration: number,
  travelBuffer?: { beforeMinutes: number; afterMinutes: number }
): number => {
  if (!travelBuffer) return baseDuration;
  return baseDuration + travelBuffer.beforeMinutes + travelBuffer.afterMinutes;
};

// Get the actual event time window from a slot that includes buffers
export const getEventTimeFromSlotWithBuffer = (
  slotStart: Date,
  duration: number,
  _travelBuffer?: { beforeMinutes: number; afterMinutes: number }
): { start: Date; end: Date } => {
  // Slot start is ALREADY the event start time (buffer is already accounted for in slot generation)
  const eventStart = slotStart;

  const eventEnd = new Date(eventStart.getTime() + duration * 60 * 1000);

  return { start: eventStart, end: eventEnd };
};