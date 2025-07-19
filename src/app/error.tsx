'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './components/ui/buttons/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
          Something went wrong!
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          {error.message || 'An unexpected error occurred'}
        </p>
        <div className="mt-6">
          <Button
            onClick={() => {
              reset();
              router.push('/');
            }}
            variant="theme"
            size="xl"
            className="w-full"
          >
            Go back home
          </Button>
        </div>
      </div>
    </div>
  );
}
