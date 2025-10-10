'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import CalendarView from '@/app/components/views/CalendarView';

export default function EditCalendarPage() {
  const searchParams = useSearchParams();
  const calendarId = searchParams.get('id');

  if (!calendarId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white/60">No calendar ID provided</p>
      </div>
    );
  }

  return <CalendarView calendarId={calendarId} />;
}
