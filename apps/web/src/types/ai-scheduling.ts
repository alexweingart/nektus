import { Place } from './places';
import { TimeSlot, Event } from './profile';

// Shared intent types to prevent drift
export type SchedulingIntent =
  | 'create_event'
  | 'navigate_to_booking_link'
  | 'modify_event'
  | 'decline'
  | 'confirm_scheduling';

export type SchedulingIntentExtended = SchedulingIntent | 'special_events';

export interface AISchedulingRequest {
  userMessage: string;
  conversationHistory: Message[];
  user1Id: string;
  user2Id: string;
  user2Name?: string;
  user2Email?: string;
  user1Location?: string;
  user2Location?: string;
  user1Coordinates?: { lat: number; lng: number }; // Coordinates from user profile
  user2Coordinates?: { lat: number; lng: number }; // Coordinates from contact profile
  userIp?: string; // For IP-based location fallback
  calendarType: 'personal' | 'work';
  availableTimeSlots?: TimeSlot[]; // Optional - now fetched from server cache
  timezone: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface AISchedulingResponse {
  intent: SchedulingIntent;
  event?: Event;
  message: string;
  showCreateButton?: boolean;
  askForConfirmation?: boolean;
}

export interface AISchedulingAcknowledgment {
  type: 'acknowledgment';
  intent: string;
  message: string;
  processingId: string;
  estimatedTimeSeconds: number;
}

export interface AISchedulingFinalResponse {
  type: 'final';
  intent: SchedulingIntentExtended;
  event?: Event;
  message: string;
  showCreateButton?: boolean;
  askForConfirmation?: boolean;
  eventsCacheKey?: string; // Cache key for "show more" functionality
}

export interface ProcessingState {
  id: string;
  status: 'processing' | 'completed' | 'error';
  request: AISchedulingRequest;
  intentResult?: DetermineIntentResult;
  result?: AISchedulingFinalResponse;
  error?: string;
  createdAt: Date;
  // Progress tracking for web search and other async operations
  progressMessage?: string;
  progressType?: 'searching' | 'processing' | 'completed';
}

export interface DetermineIntentParams {
  userMessage: string;
  conversationHistory: Message[];
}

export interface DetermineIntentResult {
  intent: SchedulingIntent;
  activityType?: string;
  intentSpecificity?: 'specific_place' | 'activity_type' | 'generic';
  activityIntent?: string;
  activitySearchQuery?: string;
  suggestedPlaceTypes?: string[];
  specificPlace?: string;
  specificTime?: string;
  modifications?: Record<string, unknown>;
  reason?: string;
}

export interface GenerateEventTemplateParams {
  intent: 'create_event' | 'modify_event';
  activityType?: string;
  specificPlace?: string;
  specificTime?: string;
  userLocations: string[];
  existingEvent?: Event;
  modifications?: Record<string, unknown>;
}

export interface GenerateEventParams {
  eventTemplate: Event;
  availableTimeSlots: TimeSlot[];
  userLocations: string[];
}

export interface GenerateEventResult {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  duration: number;
  place?: Place;
  calendarUrl: string;
  calendarProvider: string;
  message?: string;
}

export interface NavigateToBookingParams {
  calendarType: 'personal' | 'work';
  event?: Event;
}

export interface NavigateToBookingResult {
  message: string;
  calendarUrl: string;
  showCreateButton: boolean;
}

export interface TimeSlotSelection {
  timeSlot: TimeSlot;
  wasExplicitOverride: boolean;
}

export interface OpenAIFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface OpenAIToolCall {
  function: {
    name: string;
    arguments: string;
  };
}

export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';
export type Verbosity = 'low' | 'medium' | 'high';

/**
 * Result from template generation/edit handlers (Stage 3)
 * Contains the event template and metadata for business logic coordination
 */
export interface TemplateHandlerResult {
  /** Event template with scheduling constraints */
  template: Partial<Event>;

  /** Handler mode: 'new' for generateEventTemplate, 'edit' for editEventTemplate */
  mode: 'new' | 'edit';

  /** Whether this is a conditional edit ("do I have...?") */
  isConditional?: boolean;

  /** Time preference for conditional edits */
  timePreference?: 'earlier' | 'later' | 'specific';

  /** Previous event details (for edits only) */
  previousEvent?: {
    startTime: string;
    endTime: string;
    place?: Place;
  };

  /** Cached places from previous search (for edits when place type unchanged) */
  cachedPlaces?: Place[];

  /** Whether the user selected a previously suggested event (from web search results) */
  isSuggestedEvent?: boolean;

  /** Whether we need to search for places in Stage 4 */
  needsPlaceSearch: boolean;

  /** Parameters for place search (if needsPlaceSearch = true) */
  placeSearchParams?: {
    suggestedPlaceTypes?: string[];
    intentSpecificity?: 'specific_place' | 'activity_type' | 'generic';
    activitySearchQuery?: string;
    specificPlace?: string;
  };
}
