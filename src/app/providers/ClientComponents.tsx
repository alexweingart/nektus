"use client";

import React from 'react';
import { useAdminMode } from './AdminModeProvider';
import AdminBanner from '../components/ui/AdminBanner';

export default function ClientComponents() {
  const { isAdminMode } = useAdminMode();
  
  // Only render the AdminBanner when admin mode is active
  return isAdminMode ? <AdminBanner /> : null;
}
