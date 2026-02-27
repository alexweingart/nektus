'use client';

import { useState } from 'react';
import { Button } from '../buttons/Button';
import type { Event } from '@/types/profile';

interface EventCardProps {
  event: Event;
  showCreateButton?: boolean;
  onCreateEvent: (event: Event) => void;
}

export default function EventCard({ event, showCreateButton = false, onCreateEvent }: EventCardProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [isCreated, setIsCreated] = useState(!!event.calendarEventUrl);

  const formatEventSubtitle = (event: Event) => {
    if (!event.startTime || !event.endTime) return '';

    const start = new Date(event.startTime);
    const end = new Date(event.endTime);

    const displayStart = start;
    const duration = event.duration || Math.round((end.getTime() - start.getTime()) / (1000 * 60));

    const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    const startTime = displayStart.toLocaleTimeString('en-US', timeOptions);
    const dayString = formatSmartDay(displayStart);

    return `${dayString} • ${startTime} (${duration} min)`;
  };

  const formatSmartDay = (date: Date): string => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (inputDate.getTime() === today.getTime()) return 'Today';
    if (inputDate.getTime() === tomorrow.getTime()) return 'Tomorrow';

    const daysDiff = Math.floor((inputDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 0 && daysDiff <= 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await onCreateEvent(event);
      setIsCreated(true);
    } catch {
      // Fallback handled by parent
    } finally {
      setIsCreating(false);
    }
  };

  const handleViewEvent = () => {
    if (event.calendarEventUrl) {
      window.open(event.calendarEventUrl, '_blank');
    }
  };

  return (
    <div className="mt-3 p-4 bg-black/60 border border-white/10 rounded-2xl glass-tinted overflow-hidden">
      <div className="mb-3">
        <div className="text-base font-bold text-white">
          {event.title}
        </div>
        <div className="text-sm text-gray-300">
          {formatEventSubtitle(event)}
        </div>
      </div>

      {showCreateButton && !isCreated && (
        <Button
          onClick={handleCreate}
          className="w-full"
          variant="white"
          size="md"
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : 'Create Event'}
        </Button>
      )}

      {isCreated && event.calendarEventUrl && (
        <Button
          onClick={handleViewEvent}
          className="w-full"
          variant="white"
          size="md"
        >
          View Event
        </Button>
      )}
    </div>
  );
}
