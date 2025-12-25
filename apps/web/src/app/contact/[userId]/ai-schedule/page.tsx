'use client';

import AIScheduleView from '@/app/components/views/AIScheduleView';
import { PullToRefresh } from '@/app/components/ui/layout/PullToRefresh';

export default function AISchedulePage() {
  const handleRefresh = async () => {
    window.location.reload();
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <AIScheduleView />
    </PullToRefresh>
  );
}
