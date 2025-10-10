'use client';

import { Text } from '../ui/Typography';
import { Button } from '../ui/buttons/Button';
import type { Event } from '@/types/profile';

interface EventCardProps {
  event: Event;
  showCreateButton?: boolean;
  onCreateEvent: (event: Event) => void;
}

export default function EventCard({ event, showCreateButton = false, onCreateEvent }: EventCardProps) {

  const formatEventSubtitle = (event: Event) => {
    if (!event.startTime || !event.endTime) return '';

    const start = new Date(event.startTime);
    const end = new Date(event.endTime);

    // event.startTime is ALREADY the actual event start time (after buffer)
    // event.endTime is ALREADY the actual event end time (before after-buffer)
    // No need to add buffer again - just display the times as-is
    const displayStart = start;
    const duration = event.duration || Math.round((end.getTime() - start.getTime()) / (1000 * 60));

    const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    const startTime = displayStart.toLocaleTimeString('en-US', timeOptions);
    const dayString = formatSmartDay(displayStart);

    // Show event duration: "Tomorrow • 10:30 AM (60 min)"
    return `${dayString} • ${startTime} (${duration} min)`;
  };

  const formatSmartDay = (date: Date): string => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (inputDate.getTime() === today.getTime()) {
      return 'Today';
    }

    if (inputDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    }

    const daysDiff = Math.floor((inputDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 0 && daysDiff <= 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };


  return (
    <div className="mt-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="mb-3">
        <Text variant="base" className="font-medium">
          {event.title}
        </Text>
        <Text variant="subdued" className="text-sm">
          {formatEventSubtitle(event)}
        </Text>
      </div>

      {showCreateButton && (
        <Button
          onClick={() => onCreateEvent(event)}
          className="w-full"
          variant="theme"
          size="md"
        >
          Create Event
        </Button>
      )}
    </div>
  );
}
