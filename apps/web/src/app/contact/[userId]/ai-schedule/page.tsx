'use client';

import AIScheduleView from '@/app/components/views/AIScheduleView';
import { PullToRefresh } from '@/app/components/ui/layout/PullToRefresh';

export default function AISchedulePage() {
  return (
    <PullToRefresh disabled={true} onRefresh={() => {}}>
      <AIScheduleView />
    </PullToRefresh>
  );
}
