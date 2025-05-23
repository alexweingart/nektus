'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../context/UserContext';

const SetupProfile: React.FC = () => {
  const router = useRouter();
  const { userData, setUserData } = useUser();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Focus the phone input field when component mounts
  useEffect(() => {
    // Use multiple approaches to ensure keyboard appears on mobile
    if (phoneInputRef.current) {
      // Immediate focus
      phoneInputRef.current.focus();
      
      // Delayed focus as backup
      setTimeout(() => {
        phoneInputRef.current?.focus();
        
        // Additional click for stubborn mobile browsers
        phoneInputRef.current?.click();
      }, 100);
    }

    // Set up blinking cursor effect
    const interval = setInterval(() => {
      setCursorPosition(prev => prev === 0 ? 1 : 0);
    }, 500);

    return () => clearInterval(interval);
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
      
      // Navigate to the social profiles page
      router.push('/social');
    }
  };

  // Render the underlines for phone number digits
  const renderUnderlines = () => {
    const underlines = [];
    for (let i = 0; i < 10; i++) {
      const digit = phoneNumber[i] || '';
      const isFirstEmpty = phoneNumber.length === i;
      const showCursor = isFirstEmpty && cursorPosition === 1;
      
      underlines.push(
        <div key={i} style={{ 
          width: '24px', 
          display: 'inline-block',
          marginRight: i === 2 || i === 5 ? '8px' : '4px',
          textAlign: 'center',
          position: 'relative'
        }}>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 'bold',
            height: '36px',
            lineHeight: '36px'
          }}>
            {digit}
            {showCursor && (
              <span 
                style={{
                  position: 'absolute',
                  width: '2px',
                  height: '24px',
                  backgroundColor: 'var(--primary)',
                  top: '6px',
                  left: '50%',
                  transform: 'translateX(-50%)'
                }}
              ></span>
            )}
          </div>
          <div style={{ 
            height: '2px', 
            backgroundColor: digit ? 'var(--primary)' : 'var(--card-border)',
            width: '100%' 
          }}></div>
        </div>
      );
    }
    return underlines;
  };

  // Standard button style for consistency
  const buttonStyle = {
    display: 'block',
    width: '100%',
    backgroundColor: phoneNumber.length === 10 ? 'var(--primary)' : 'var(--card-border)',
    color: 'white',
    fontSize: '22px',
    fontWeight: '500',
    padding: '16px 24px',
    borderRadius: '100px',
    boxShadow: 'var(--shadow-md)',
    transition: 'all 0.2s ease-in-out',
    textDecoration: 'none',
    textAlign: 'center',
    border: 'none',
    cursor: phoneNumber.length === 10 ? 'pointer' : 'not-allowed',
    marginTop: '10px'
  };

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: '10vh' // Position elements higher on the screen
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '320px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
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
          Enter Your Phone Number
        </h1>
        
        <div style={{ 
          width: '100%', 
          marginBottom: '40px',
          display: 'flex',
          justifyContent: 'center',
          position: 'relative'
        }}>
          <input
            ref={phoneInputRef}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            value={phoneNumber}
            onChange={handlePhoneNumberChange}
            aria-label="Phone Number"
            autoFocus={true}
            style={{
              opacity: 0,
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              fontSize: '24px',
              cursor: 'default'
            }}
          />
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center',
            width: '100%',
            userSelect: 'none'
          }}>
            {renderUnderlines()}
          </div>
        </div>
        
        <button
          onClick={handleSubmit}
          disabled={phoneNumber.length !== 10}
          style={buttonStyle}
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
