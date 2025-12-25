'use client';

import SmartScheduleView from '@/app/components/views/SmartScheduleView';
import { PullToRefresh } from '@/app/components/ui/layout/PullToRefresh';

export default function SmartSchedulePage() {
  const handleRefresh = async () => {
    window.location.reload();
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <SmartScheduleView />
    </PullToRefresh>
  );
}
