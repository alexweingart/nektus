import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Vibration } from 'react-native';

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
  // Ensure admin mode is off by default
  const [isAdminMode, setIsAdminMode] = useState(false);

  const toggleAdminMode = () => {
    setIsAdminMode(prev => !prev);
    // Vibrate on toggle
    Vibration.vibrate(200);
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
