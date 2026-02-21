'use client';

import Link from 'next/link';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl mb-4">Lost in the sauce</p>
        <p className="text-muted-foreground mb-8">
          This page doesn&apos;t exist. Maybe it never did.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          Get me out of here
        </Link>
      </div>
    </div>
  );
}
