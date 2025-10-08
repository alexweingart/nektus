import { Place } from './places';

// TimeSlot and Event will be imported from profile.ts after we add them there
export interface TimeSlot {
  start: string;
  end: string;
}

export interface AISchedulingRequest {
  userMessage: string;
  conversationHistory: Message[];
  user1Id: string;
  user2Id: string;
  user2Name?: string;
  user2Email?: string;
  user1Location?: string;
  user2Location?: string;
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
  intent: 'create_event' | 'navigate_to_booking_link' | 'modify_event' | 'decline' | 'confirm_scheduling';
  event?: any; // Will use Event type from profile.ts
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
  intent: 'create_event' | 'navigate_to_booking_link' | 'modify_event' | 'decline' | 'confirm_scheduling' | 'special_events';
  event?: any; // Will use Event type from profile.ts
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
  intent: 'create_event' | 'confirm_scheduling' | 'navigate_to_booking_link' | 'modify_event' | 'decline';
  activityType?: string;
  intentSpecificity?: 'specific_place' | 'activity_type' | 'generic';
  activityIntent?: string;
  activitySearchQuery?: string;
  suggestedPlaceTypes?: string[];
  specificPlace?: string;
  specificTime?: string;
  modifications?: Record<string, any>;
  reason?: string;
}

export interface GenerateEventTemplateParams {
  intent: 'create_event' | 'modify_event';
  activityType?: string;
  specificPlace?: string;
  specificTime?: string;
  userLocations: string[];
  existingEvent?: any; // Will use Event type from profile.ts
  modifications?: Record<string, any>;
}

export interface GenerateEventParams {
  eventTemplate: any; // Will use Event type from profile.ts
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
}

export interface NavigateToBookingParams {
  calendarType: 'personal' | 'work';
  event?: any; // Will use Event type from profile.ts
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
    properties: Record<string, any>;
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
