import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { getServerSession } from "next-auth/next";

// Server-side session helper
export const getAuthSession = async () => {
  try {
    const session = await getServerSession(authOptions);
    // Don't try to initialize Firebase here - it will be handled automatically
    return session;
  } catch (error) {
    console.error('Error getting auth session:', error);
    return null;
  }
};

// Client-side session helper
export const getClientAuthSession = async () => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const response = await fetch('/api/auth/session');
    if (!response.ok) {
      throw new Error('Failed to fetch session');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching client session:', error);
    return null;
  }
};

export const getRequiredAuthSession = async () => {
  const session = await getAuthSession();
  if (!session?.user) {
    throw new Error("User not authenticated");
  }
  return session;
};

// Helper to check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  if (typeof window === 'undefined') {
    const session = await getAuthSession();
    return !!session?.user;
  } else {
    const session = await getClientAuthSession();
    return !!session?.user;
  }
};
