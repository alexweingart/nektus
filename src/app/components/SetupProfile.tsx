'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../context/UserContext';

const SetupProfile: React.FC = () => {
  const router = useRouter();
  const { userData, setUserData } = useUser();
  const [phoneNumber, setPhoneNumber] = useState('');
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Focus the phone input field when component mounts
  useEffect(() => {
    if (phoneInputRef.current) {
      phoneInputRef.current.focus();
    }
  }, []);

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only numbers and limit to 10 digits
    const value = e.target.value.replace(/\D/g, '').substring(0, 10);
    setPhoneNumber(value);
  };

  const handleSubmit = () => {
    if (phoneNumber.length === 10) {
      // Save phone number to context
      setUserData(prev => ({ ...prev, phone: phoneNumber }));
      
      // Navigate to the next step (we'll implement this later)
      router.push('/profile');
    }
  };

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '320px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          animation: 'fadeIn 0.3s ease-out forwards'
        }}
      >
        <h1 
          style={{ 
            color: 'var(--primary)',
            fontSize: '32px',
            fontWeight: 'bold',
            marginBottom: '40px',
            textAlign: 'center',
            width: '100%'
          }}
        >
          Create Your Profile
        </h1>
        
        <div style={{ width: '100%', marginBottom: '50px' }}>
          <input
            ref={phoneInputRef}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            value={phoneNumber}
            onChange={handlePhoneNumberChange}
            placeholder="Phone Number"
            style={{
              width: '100%',
              fontSize: '24px',
              letterSpacing: '8px', 
              textAlign: 'center',
              padding: '12px',
              border: 'none',
              borderBottom: '2px solid var(--primary)',
              outline: 'none',
              backgroundColor: 'transparent',
              borderRadius: '0',
              boxShadow: 'none'
            }}
          />
        </div>
        
        <button
          onClick={handleSubmit}
          disabled={phoneNumber.length !== 10}
          style={{
            display: 'block',
            width: '100%',
            backgroundColor: phoneNumber.length === 10 ? 'var(--primary)' : 'var(--card-border)',
            color: 'white',
            fontSize: '26px',
            fontWeight: '500',
            padding: '20px 24px',
            borderRadius: '100px',
            boxShadow: 'var(--shadow-md)',
            transition: 'all 0.2s ease-in-out',
            textDecoration: 'none',
            textAlign: 'center',
            border: 'none',
            cursor: phoneNumber.length === 10 ? 'pointer' : 'not-allowed'
          }}
          onMouseOver={(e) => {
            if (phoneNumber.length === 10) {
              e.currentTarget.style.backgroundColor = 'var(--primary-dark)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
            }
          }}
          onMouseOut={(e) => {
            if (phoneNumber.length === 10) {
              e.currentTarget.style.backgroundColor = 'var(--primary)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default SetupProfile;
