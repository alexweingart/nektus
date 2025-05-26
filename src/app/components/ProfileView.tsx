'use client';

import React, { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { FaPhone, FaEnvelope, FaFacebook, FaInstagram, FaWhatsapp, 
         FaSnapchat, FaTelegram, FaLinkedin } from 'react-icons/fa';

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

// Function to get placeholder bio
const PLACEHOLDER_BIOS = [
  "Creative soul with an adventurous spirit",
  "Professional dreamer, part-time explorer",
  "Coffee lover, always smiling",
  "Digital nomad chasing sunsets",
  "Tech enthusiast with a big heart",
  "Passionate about connecting people",
  "Creating moments worth sharing"
];

const getPlaceholderBio = (name: string) => {
  const nameSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return PLACEHOLDER_BIOS[nameSum % PLACEHOLDER_BIOS.length];
};

const ProfileView: React.FC = () => {
  const { profile, isLoading } = useProfile();
  const { data: session } = useSession();
  
  // State for progressively loaded content
  const [bio, setBio] = useState<string>("");
  const [bgImage, setBgImage] = useState<string>("/gradient-bg.jpg");
  const [isAIContentLoading, setIsAIContentLoading] = useState<boolean>(false);
  
  // Format phone number for display
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    
    // Remove any non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    
    // Format based on length
    if (digitsOnly.length === 10) {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    } else if (digitsOnly.length > 10) {
      // Assume international format
      return `+${digitsOnly.slice(0, digitsOnly.length-10)} (${digitsOnly.slice(-10, -7)}) ${digitsOnly.slice(-7, -4)}-${digitsOnly.slice(-4)}`;
    }
    return phone; // Return original if we can't format it
  };

  // Load AI content asynchronously after component mounts
  useEffect(() => {
    const loadAIContent = async () => {
      if (!profile) return;
      
      // Set initial placeholder bio based on name
      setBio(getPlaceholderBio(profile.name));
      
      try {
        setIsAIContentLoading(true);
        
        // Generate bio in background
        const response = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'bio',
            profile,
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          setBio(data.bio);
        }
        
        // Generate background image in background
        const bgResponse = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'background',
            profile,
          }),
        });
        
        if (bgResponse.ok) {
          const bgData = await bgResponse.json();
          setBgImage(bgData.imageUrl);
        }
      } catch (error) {
        console.error('Error loading AI content:', error);
      } finally {
        setIsAIContentLoading(false);
      }
    };
    
    if (profile && !isLoading) {
      loadAIContent();
    }
  }, [profile, isLoading]);

  // Show loading state if profile data is loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show message if no profile exists
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <h1 className="text-2xl font-bold text-primary mb-4">Profile Not Found</h1>
        <p className="text-center mb-6">Please create your profile first.</p>
        <Link href="/setup" className="bg-primary text-white px-6 py-3 rounded-full font-medium hover:bg-primary-dark transition-colors">
          Create Profile
        </Link>
      </div>
    );
  }

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100%',
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        transition: 'background-image 0.5s ease-in-out'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '500px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          animation: 'fadeIn 0.3s ease-out forwards',
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          margin: '20px'
        }}
      >
        {/* Profile Photo and Name */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          {profile.picture ? (
            <div style={{ width: '120px', height: '120px', margin: '0 auto 16px', borderRadius: '60px', overflow: 'hidden', border: '3px solid white' }}>
              <img 
                src={profile.picture} 
                alt={profile.name || 'Profile'} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div style={{ width: '120px', height: '120px', margin: '0 auto 16px', borderRadius: '60px', backgroundColor: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '48px', fontWeight: 'bold' }}>{profile.name?.[0] || '?'}</span>
            </div>
          )}
          <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>
            {profile.name}
          </h2>
          
          {/* Bio - show placeholder while loading */}
          <p style={{ 
            fontSize: '16px', 
            color: 'rgba(255,255,255,0.8)', 
            maxWidth: '320px',
            margin: '0 auto',
            fontStyle: 'italic',
            transition: 'opacity 0.3s ease'
          }}>
            {bio || (isAIContentLoading ? 'Creating your personalized bio...' : 'No bio available')}
          </p>
        </div>
        
        {/* Contact & Social Icons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
          {/* Phone */}
          {profile.phone && (
            <a href={`tel:${profile.phone}`} style={{ textDecoration: 'none' }}>
              <div style={{ 
                width: '50px', 
                height: '50px', 
                borderRadius: '25px', 
                backgroundColor: 'rgba(255,255,255,0.2)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'white',
                transition: 'all 0.2s ease'
              }}>
                <FaPhone size={20} />
              </div>
            </a>
          )}
          
          {/* Email */}
          {profile.email && (
            <a href={`mailto:${profile.email}`} style={{ textDecoration: 'none' }}>
              <div style={{ 
                width: '50px', 
                height: '50px', 
                borderRadius: '25px', 
                backgroundColor: 'rgba(255,255,255,0.2)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'white',
                transition: 'all 0.2s ease'
              }}>
                <FaEnvelope size={20} />
              </div>
            </a>
          )}
          
          {/* Social Media Icons - only show if profiles exist */}
          {profile.socialProfiles && profile.socialProfiles.map(social => {
            // Skip if username is empty
            if (!social.username) return null;
            
            let icon = null;
            let url = '';
            
            switch(social.platform) {
              case 'facebook':
                icon = <FaFacebook size={20} />;
                url = `https://facebook.com/${social.username}`;
                break;
              case 'instagram':
                icon = <FaInstagram size={20} />;
                url = `https://instagram.com/${social.username}`;
                break;
              case 'whatsapp':
                icon = <FaWhatsapp size={20} />;
                url = `https://wa.me/${social.username}`;
                break;
              case 'snapchat':
                icon = <FaSnapchat size={20} />;
                url = `https://snapchat.com/add/${social.username}`;
                break;
              case 'telegram':
                icon = <FaTelegram size={20} />;
                url = `https://t.me/${social.username}`;
                break;
              case 'linkedin':
                icon = <FaLinkedin size={20} />;
                url = `https://linkedin.com/in/${social.username}`;
                break;
              default:
                return null;
            }
            
            return (
              <a key={social.platform} href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{ 
                  width: '50px', 
                  height: '50px', 
                  borderRadius: '25px', 
                  backgroundColor: 'rgba(255,255,255,0.2)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: 'white',
                  transition: 'all 0.2s ease'
                }}>
                  {icon}
                </div>
              </a>
            );
          })}
        </div>
        
        {/* Action Buttons */}
        <div style={{ width: '100%', maxWidth: '320px' }}>
          <Link 
            href="/connect"
            style={{
              ...standardButtonStyle,
              backgroundColor: 'var(--primary)',
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
            Nekt
          </Link>
          
          <Link 
            href="/setup"
            style={{
              ...standardButtonStyle,
              backgroundColor: 'transparent',
              border: '2px solid var(--primary)',
              color: 'var(--primary)',
              marginTop: '12px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Edit Profile
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
