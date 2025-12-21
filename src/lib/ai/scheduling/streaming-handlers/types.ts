import type { Event } from '@/types';
import type { Place } from '@/types/places';

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
