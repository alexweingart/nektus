'use client';

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { ReactNode, useEffect, useRef } from "react";
import { Session } from "next-auth";

interface SessionProviderProps {
  children: ReactNode;
  session: Session | null;
}

export function SessionProvider({ children, session }: SessionProviderProps) {
  const initialRender = useRef(true);
  const prevSessionRef = useRef<Session | null>(null);

  // Log session changes for debugging in development only
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    
    // Skip initial mount in development due to StrictMode double render
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    // Only log if session actually changed
    if (session !== prevSessionRef.current) {
      if (session) {
        // Calculate 30 days expiration if not defined
        const expiresDate = session.expires || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        
        // Only log in development environment
        if (process.env.NODE_ENV === 'development') {
          console.log('🔑 Session:', session.user?.email || 'Unknown user');
        }
      } else {
        // Only log in development environment
        if (process.env.NODE_ENV === 'development') {
          console.log('🔒 No session');
        }
      }
      prevSessionRef.current = session;
    }
  }, [session]);

  return (
    <NextAuthSessionProvider 
      session={session}
      // Refetch session every 5 minutes if the window is focused
      refetchInterval={5 * 60}
      refetchOnWindowFocus={true}
      // Don't refetch session when the window regains focus in development
      // to avoid too many requests during development
      refetchWhenOffline={false}
    >
      {children}
    </NextAuthSessionProvider>
  );
}
