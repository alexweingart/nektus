'use client';

import React from 'react';
import { useUser } from '../context/UserContext';
import Link from 'next/link';

// Standard button style shared across the application as a React style object
const standardButtonStyle = {
  display: 'block',
  width: '100%',
  backgroundColor: 'var(--primary)',
  color: 'white',
  fontSize: '22px',
  fontWeight: '500',
  padding: '16px 24px',
  borderRadius: '100px',
  boxShadow: 'var(--shadow-md)',
  transition: 'all 0.2s ease-in-out',
  textDecoration: 'none',
  textAlign: 'center' as const, // Type assertion to fix TypeScript error
  border: 'none',
  cursor: 'pointer',
  marginTop: '10px'
};

const ProfileView: React.FC = () => {
  const { userData } = useUser();

  // Format phone number as XXX-XXX-XXXX
  const formatPhoneNumber = (phone: string) => {
    if (!phone || phone.length !== 10) return phone;
    return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
  };

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        overflow: 'auto',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: '6vh',
        paddingBottom: '6vh'
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
            marginBottom: '24px',
            textAlign: 'center',
            width: '100%'
          }}
        >
          Your Profile
        </h1>
        
        <div
          style={{
            backgroundColor: 'var(--card-bg)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-md)',
            padding: '24px',
            marginBottom: '24px',
            width: '100%'
          }}
        >
          {/* Contact Info */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: 'bold', 
              color: 'var(--primary)',
              marginBottom: '16px'
            }}>
              Contact Information
            </h2>
            
            {userData.phone && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', color: 'var(--secondary-dark)', marginBottom: '4px' }}>
                  Phone
                </div>
                <div style={{ fontSize: '16px' }}>
                  {formatPhoneNumber(userData.phone)}
                </div>
              </div>
            )}
            
            {userData.email && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', color: 'var(--secondary-dark)', marginBottom: '4px' }}>
                  Email
                </div>
                <div style={{ fontSize: '16px' }}>
                  {userData.email}
                </div>
              </div>
            )}
          </div>
          
          {/* Social Profiles */}
          {userData.socialProfiles && userData.socialProfiles.length > 0 && (
            <div>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: 'bold', 
                color: 'var(--primary)',
                marginBottom: '16px'
              }}>
                Social Profiles
              </h2>
              
              {userData.socialProfiles.map((profile) => (
                <div key={profile.platform} style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '14px', color: 'var(--secondary-dark)', marginBottom: '4px', textTransform: 'capitalize' }}>
                    {profile.platform}
                  </div>
                  <div style={{ fontSize: '16px' }}>
                    {profile.username}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <Link 
          href="/connect"
          style={{
            display: 'block',
            width: '100%',
            backgroundColor: 'var(--primary)',
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
            cursor: 'pointer',
            marginTop: '10px'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--primary-dark)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--primary)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          }}
        >
          Start Connecting
        </Link>
        
        <Link 
          href="/setup"
          style={{
            fontSize: '16px',
            color: 'var(--primary)',
            textDecoration: 'none',
            padding: '8px',
            marginTop: '12px'
          }}
        >
          Edit Profile
        </Link>
      </div>
    </div>
  );
};

export default ProfileView;
