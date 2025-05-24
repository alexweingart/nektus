"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useProfile } from '../context/ProfileContext';
import { FaWhatsapp, FaTelegram, FaFacebook, FaInstagram, FaTwitter, FaSnapchat, FaLinkedin } from 'react-icons/fa';

export default function ConnectPage() {
  const { data: session, status } = useSession();
  const { profile, isLoading } = useProfile();
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);

  // Redirect to home if not logged in
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Redirect to setup if profile is not complete
  useEffect(() => {
    if (!isLoading && profile && (!profile.phone || profile.phone.length < 10)) {
      router.push('/setup');
    }
  }, [profile, isLoading, router]);

  // Function to get the icon for a social platform
  const getSocialIcon = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return <FaFacebook size={20} />;
      case 'instagram':
        return <FaInstagram size={20} />;
      case 'twitter':
        return <FaTwitter size={20} />;
      case 'snapchat':
        return <FaSnapchat size={20} />;
      case 'linkedin':
        return <FaLinkedin size={20} />;
      case 'whatsapp':
        return <FaWhatsapp size={20} />;
      case 'telegram':
        return <FaTelegram size={20} />;
      default:
        return null;
    }
  };

  // Style definitions
  const containerStyle = {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '24px',
    color: 'var(--text)',
  };

  const headerStyle = {
    fontSize: '32px',
    fontWeight: 'bold' as const,
    marginBottom: '48px',
    color: 'var(--primary)',
    textAlign: 'center' as const,
  };

  const profileCardStyle = {
    backgroundColor: 'var(--card-bg)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    marginBottom: '24px',
  };

  const buttonStyle = {
    display: 'block',
    width: '100%',
    padding: '14px 20px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: '100px',
    fontSize: '16px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  };

  // Handle starting the Bluetooth connection process
  const handleConnect = () => {
    setIsConnecting(true);
    // In a future implementation, this would initiate the Web Bluetooth API
    // For now, just show a loading state
    setTimeout(() => {
      alert('Bluetooth functionality coming soon!');
      setIsConnecting(false);
    }, 1500);
  };

  if (status === 'loading' || isLoading) {
    return (
      <div style={containerStyle}>
        <h1 style={headerStyle}>Loading...</h1>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>Ready to Connect</h1>

      {profile && (
        <div style={profileCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            {profile.picture && (
              <img
                src={profile.picture}
                alt={profile.name}
                style={{ width: '60px', height: '60px', borderRadius: '50%', marginRight: '16px' }}
              />
            )}
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>{profile.name}</h3>
              <p style={{ margin: '0', color: 'var(--secondary)', fontSize: '14px' }}>{profile.phone}</p>
            </div>
          </div>

          {profile.handle && (
            <p style={{ margin: '8px 0', fontSize: '16px' }}>
              Handle: <strong>@{profile.handle}</strong>
            </p>
          )}

          {profile.socialProfiles && profile.socialProfiles.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h4 style={{ marginBottom: '8px' }}>Your Social Profiles:</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {profile.socialProfiles.map((social, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: 'var(--input-bg)',
                      padding: '8px 12px',
                      borderRadius: '100px',
                      margin: '0 8px 8px 0',
                    }}
                  >
                    <span style={{ marginRight: '8px', color: 'var(--primary)' }}>
                      {getSocialIcon(social.platform)}
                    </span>
                    <span style={{ fontSize: '14px' }}>{social.username}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '32px' }}>
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          style={{
            ...buttonStyle,
            opacity: isConnecting ? 0.7 : 1,
            cursor: isConnecting ? 'not-allowed' : 'pointer',
          }}
        >
          {isConnecting ? (
            <>
              <span
                style={{
                  display: 'inline-block',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  animation: 'spin 1s linear infinite',
                  marginRight: '8px',
                  verticalAlign: 'middle',
                }}
              />
              Connecting...
            </>
          ) : (
            'Bump Phones to Connect'
          )}
        </button>

        <p style={{ textAlign: 'center', color: 'var(--secondary)', marginTop: '16px', fontSize: '14px' }}>
          When someone else is nearby with Nekt.Us open, tap the button and bump phones to exchange contacts.
        </p>
      </div>

      <style jsx global>{`
        :root {
          --primary: #4caf50;
          --primary-light: #81c784;
          --primary-dark: #388e3c;
          --secondary: #666666;
          --secondary-dark: #888888;
          --text: #333333;
          --card-bg: #ffffff;
          --border: #dddddd;
          --input-bg: #f5f5f5;
          --danger: #e53935;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        body {
          background-color: #f0f2f5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          margin: 0;
          padding: 0;
        }
      `}</style>
    </div>
  );
}
