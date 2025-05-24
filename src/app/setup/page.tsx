'use client';

import React from 'react';
import ProfileSetup from '../components/ProfileSetup';
import { useSearchParams } from 'next/navigation';
import styles from './setup.module.css';

export default function SetupPage() {
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');
  
  return (
    <div className={styles.setupContainer}>
      {error && (
        <div className={styles.errorMessage}>
          There was a problem with Google sign-in. Please try again.
        </div>
      )}
      
      <div style={{ maxWidth: '28rem', margin: '0 auto' }}>
        <ProfileSetup />
      </div>
    </div>
  );
}
