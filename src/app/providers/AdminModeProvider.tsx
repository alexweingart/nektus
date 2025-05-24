"use client";

import React, { createContext, useState, useContext, ReactNode } from 'react';

// Create a context for admin mode
type AdminModeContextType = {
  isAdminMode: boolean;
  toggleAdminMode: () => void;
  closeAdminMode: () => void;
};

const AdminModeContext = createContext<AdminModeContextType>({
  isAdminMode: false,
  toggleAdminMode: () => {},
  closeAdminMode: () => {}
});

// Hook to use admin mode context
export const useAdminMode = () => useContext(AdminModeContext);

// Provider component that wraps the app and provides admin mode functionality
export default function AdminModeProvider({ children }: { children: ReactNode }) {
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  const toggleAdminMode = () => {
    setIsAdminMode(prev => !prev);
    // Vibrate if supported (mobile devices)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(200);
    }
  };
  
  const closeAdminMode = () => {
    setIsAdminMode(false);
  };
  
  return (
    <AdminModeContext.Provider value={{ isAdminMode, toggleAdminMode, closeAdminMode }}>
      {children}
    </AdminModeContext.Provider>
  );
}
