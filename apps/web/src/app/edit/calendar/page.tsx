'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CalendarView from '@/app/components/views/CalendarView';

function EditCalendarContent() {
  const searchParams = useSearchParams();
  const calendarId = searchParams.get('id');

  if (!calendarId) {
    return (
      <div className="flex items-center justify-center">
        <p className="text-white/60">No calendar ID provided</p>
      </div>
    );
  }

  return <CalendarView calendarId={calendarId} />;
}

export default function EditCalendarPage() {
  return (
    <Suspense fallback={null}>
      <EditCalendarContent />
    </Suspense>
  );
}
