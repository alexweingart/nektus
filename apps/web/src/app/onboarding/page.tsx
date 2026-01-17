'use client';

import dynamicImport from 'next/dynamic';
import { HomeFooter } from '../components/views/HomePage';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Same HomePage component - this URL exists to trigger App Clip card
const HomePage = dynamicImport(() => import('../components/views/HomePage'), {
  ssr: false,
  loading: () => null
});

export default function OnboardingPage() {
  // This page shows identical content to the home page
  // The purpose is to provide a navigation target that triggers the App Clip card
  // iOS shows the App Clip card when navigating to a new URL
  return (
    <>
      <HomePage />
      <HomeFooter />
    </>
  );
}
