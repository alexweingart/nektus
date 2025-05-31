"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useProfile } from '../context/ProfileContext';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { FaPhone, FaEnvelope, FaFacebook, FaInstagram, FaWhatsapp, 
         FaSnapchat, FaTelegram, FaLinkedin, FaPen, FaExclamation, FaMagic } from 'react-icons/fa';

// Single instructional placeholder bio
const PLACEHOLDER_BIO = "AI will create a bio here for you, or tap edit profile to write your own";

// Get placeholder bio - now returns a single consistent message
const getPlaceholderBio = () => {
  return PLACEHOLDER_BIO;
};

// AI-powered bio generation
const generateAIBio = async (profile: any) => {
  try {
    const response = await fetch('/api/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'bio',
        profile,
      }),
    });
    
    if (!response.ok) throw new Error('Failed to generate bio');
    
    const data = await response.json();
    return data.bio;
  } catch (error) {
    console.error('Error generating bio:', error);
    return getPlaceholderBio();
  }
};

// AI-powered background image generation
const generateAIBackground = async (profile: any) => {
  try {
    const response = await fetch('/api/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'background',
        profile,
      }),
    });
    
    if (!response.ok) throw new Error('Failed to generate background image');
    
    const data = await response.json();
    return data.imageUrl;
  } catch (error) {
    console.error('Error generating background:', error);
    return ''; // Return empty string to indicate no background
  }
};

// AI-powered avatar generation
const generateAIAvatar = async (profile: any) => {
  try {
    const response = await fetch('/api/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'avatar',
        profile,
      }),
    });
    
    if (!response.ok) throw new Error('Failed to generate avatar');
    
    const data = await response.json();
    return data.imageUrl;
  } catch (error) {
    console.error('Error generating avatar:', error);
    return profile.picture || '/default-avatar.png';
  }
};

// Function to generate social links based on profile data
const generateSocialLinks = (profile: any) => {
  const links = {
    phone: { url: `tel:${profile.phone}`, auto: false },
    email: { url: `mailto:${profile.email}`, auto: false }
  };
  
  // Extract username from email (text before @)
  const username = profile.email.split('@')[0];
  
  // Generate social links with auto-generation flags
  return {
    ...links,
    facebook: { url: `https://facebook.com/${username}`, auto: true, valid: true },
    instagram: { url: `https://instagram.com/${username}`, auto: true, valid: true },
    snapchat: { url: `https://snapchat.com/add/${username}`, auto: true, valid: true },
    linkedin: { url: `https://linkedin.com/in/${username}`, auto: true, valid: true },
    whatsapp: { url: `https://wa.me/${profile.phone.replace(/[^0-9]/g, '')}`, auto: true, valid: true },
    telegram: { url: `https://t.me/${profile.phone.replace(/[^0-9]/g, '')}`, auto: true, valid: true }
  };
};

// Validate social links (in a real app, this would make API calls to verify accounts)
const validateSocialLinks = async (links: any) => {
  // Simulate API validation by returning the same links with some randomly set to invalid
  // In a real implementation, this would call APIs to check if the profiles exist
  return Object.entries(links).reduce((acc: any, [key, value]: [string, any]) => {
    if (value.auto) {
      // 70% chance of a link being valid for demo purposes
      acc[key] = { ...value, valid: Math.random() > 0.3 };
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
};

export default function ConnectPage() {
  const { status } = useSession();
  const { profile, isLoading } = useProfile();
  const router = useRouter();
  const [socialLinks, setSocialLinks] = useState<any>(null);
  const [bio, setBio] = useState<string>('');
  const [bgImage, setBgImage] = useState<string>('');
  const [avatarImage, setAvatarImage] = useState<string>('/default-avatar.png');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  
  // Redirect to login if not authenticated
  if (status === 'unauthenticated') {
    redirect('/');
  }
  
  // Generate initial content when profile is loaded
  useEffect(() => {
    if (profile) {
      // Set initial values with placeholders
      const initialLinks = generateSocialLinks(profile);
      setSocialLinks(initialLinks);
      setBio(getPlaceholderBio());
      setAvatarImage(profile.profileImage || '/default-avatar.png');
      
      // Start AI generation asynchronously
      const generateAIContent = async () => {
        try {
          setIsGenerating(true);
          
          // Generate and validate all content in parallel
          const [aiBackground, aiAvatar, aiBio, validatedLinks] = await Promise.all([
            generateAIBackground(profile),
            generateAIAvatar(profile),
            generateAIBio(profile),
            validateSocialLinks(initialLinks)
          ]);
          
          // Update state with AI-generated content
          setBgImage(aiBackground);
          setAvatarImage(aiAvatar);
          setBio(aiBio);
          setSocialLinks(validatedLinks);
        } catch (error) {
          console.error('Error generating AI content:', error);
        } finally {
          setIsGenerating(false);
        }
      };
      
      generateAIContent();
    }
  }, [profile]);
  
  // Handle Nekt button click
  const handleNektClick = () => {
    // TODO: Implement Nekt functionality
    // Handle Nekt button click action
  };
  
  // Show loading state while checking authentication or profile
  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  // Redirect to profile setup if profile is incomplete
  if (!profile) {
    redirect('/setup');
  }
  
  const phoneNumber = profile.contactChannels.phoneInfo.internationalPhone || '';
  if (!phoneNumber) {
    redirect('/setup');
  }
  
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background with AI-generated gradient overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center z-0" 
        style={{
          backgroundImage: `url('${bgImage}')`,
          filter: 'blur(4px)',
          transform: 'scale(1.1)',
          transition: 'background-image 0.5s ease-in-out'
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70 z-10" />
      
      {/* Content container */}
      <div className="relative z-20 flex flex-col items-center px-6 py-12 max-w-md mx-auto h-full">
        {/* Profile image - AI enhanced */}
        <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl mb-4">
          <Image 
            src={avatarImage} 
            alt={profile.name}
            fill
            className="object-cover"
            priority
          />
          {isGenerating && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <LoadingSpinner size="md" className="text-white" />
            </div>
          )}
        </div>
        
        {/* Name */}
        <h1 className="text-2xl font-bold text-white mb-1">{profile.name}</h1>
        
        {/* Bio - AI generated */}
        <div className="relative">
          <p className="text-white/90 text-sm mb-8 text-center">{bio}</p>
          {isGenerating && (
            <div className="absolute -top-1 -right-5 w-4 h-4 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
              <FaMagic size={10} className="text-yellow-400" />
            </div>
          )}
        </div>
        
        {/* Social icons */}
        <div className="grid grid-cols-4 gap-4 w-full max-w-xs mb-10">
          {/* Phone */}
          <a href={socialLinks?.phone.url} className="flex flex-col items-center">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/20 transition">
              <FaPhone size={20} />
            </div>
            <span className="text-white/80 text-xs mt-1">Phone</span>
          </a>
          
          {/* Email */}
          <a href={socialLinks?.email.url} className="flex flex-col items-center">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/20 transition">
              <FaEnvelope size={20} />
            </div>
            <span className="text-white/80 text-xs mt-1">Email</span>
          </a>
          
          {/* Facebook */}
          <a href={socialLinks?.facebook.url} className="flex flex-col items-center">
            <div className="relative w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/20 transition">
              <FaFacebook size={20} />
              {socialLinks?.facebook.auto && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                  <FaExclamation size={8} color="#000" />
                </div>
              )}
              {!socialLinks?.facebook.valid && socialLinks?.facebook.auto && (
                <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-75">
                  <span className="text-white text-[8px]">!</span>
                </div>
              )}
            </div>
            <span className="text-white/80 text-xs mt-1">Facebook</span>
          </a>
          
          {/* Instagram */}
          <a href={socialLinks?.instagram.url} className="flex flex-col items-center">
            <div className="relative w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/20 transition">
              <FaInstagram size={20} />
              {socialLinks?.instagram.auto && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                  <FaExclamation size={8} color="#000" />
                </div>
              )}
              {!socialLinks?.instagram.valid && socialLinks?.instagram.auto && (
                <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-75">
                  <span className="text-white text-[8px]">!</span>
                </div>
              )}
            </div>
            <span className="text-white/80 text-xs mt-1">Instagram</span>
          </a>
          
          {/* WhatsApp */}
          <a href={socialLinks?.whatsapp.url} className="flex flex-col items-center">
            <div className="relative w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/20 transition">
              <FaWhatsapp size={20} />
              {socialLinks?.whatsapp.auto && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                  <FaExclamation size={8} color="#000" />
                </div>
              )}
              {!socialLinks?.whatsapp.valid && socialLinks?.whatsapp.auto && (
                <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-75">
                  <span className="text-white text-[8px]">!</span>
                </div>
              )}
            </div>
            <span className="text-white/80 text-xs mt-1">WhatsApp</span>
          </a>
          
          {/* SnapChat */}
          <a href={socialLinks?.snapchat.url} className="flex flex-col items-center">
            <div className="relative w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/20 transition">
              <FaSnapchat size={20} />
              {socialLinks?.snapchat.auto && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                  <FaExclamation size={8} color="#000" />
                </div>
              )}
              {!socialLinks?.snapchat.valid && socialLinks?.snapchat.auto && (
                <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-75">
                  <span className="text-white text-[8px]">!</span>
                </div>
              )}
            </div>
            <span className="text-white/80 text-xs mt-1">SnapChat</span>
          </a>
          
          {/* Telegram */}
          <a href={socialLinks?.telegram.url} className="flex flex-col items-center">
            <div className="relative w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/20 transition">
              <FaTelegram size={20} />
              {socialLinks?.telegram.auto && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                  <FaExclamation size={8} color="#000" />
                </div>
              )}
              {!socialLinks?.telegram.valid && socialLinks?.telegram.auto && (
                <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-75">
                  <span className="text-white text-[8px]">!</span>
                </div>
              )}
            </div>
            <span className="text-white/80 text-xs mt-1">Telegram</span>
          </a>
          
          {/* LinkedIn */}
          <a href={socialLinks?.linkedin.url} className="flex flex-col items-center">
            <div className="relative w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/20 transition">
              <FaLinkedin size={20} />
              {socialLinks?.linkedin.auto && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                  <FaExclamation size={8} color="#000" />
                </div>
              )}
              {!socialLinks?.linkedin.valid && socialLinks?.linkedin.auto && (
                <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-75">
                  <span className="text-white text-[8px]">!</span>
                </div>
              )}
            </div>
            <span className="text-white/80 text-xs mt-1">LinkedIn</span>
          </a>
        </div>
        
        {/* Nekt button */}
        <button 
          onClick={handleNektClick}
          className="w-full max-w-xs bg-green-500 text-white font-bold py-3 px-6 rounded-full text-lg shadow-lg hover:bg-green-600 transition mb-4"
        >
          Nekt
        </button>
        
        {/* Edit link */}
        <Link href="/profile" className="text-green-400 hover:text-green-300 transition flex items-center">
          <FaPen size={12} className="mr-1" /> Edit
        </Link>
        
        {/* Generate new AI content button */}
        <button 
          onClick={() => {
            if (profile) {
              // Start AI generation asynchronously
              const generateAIContent = async () => {
                try {
                  setIsGenerating(true);
                  
                  // Generate all content in parallel
                  const [aiBackground, aiAvatar, aiBio] = await Promise.all([
                    generateAIBackground(profile),
                    generateAIAvatar(profile),
                    generateAIBio(profile)
                  ]);
                  
                  // Update state with AI-generated content
                  setBgImage(aiBackground);
                  setAvatarImage(aiAvatar);
                  setBio(aiBio);
                } catch (error) {
                  // Handle error in AI content regeneration
                } finally {
                  setIsGenerating(false);
                }
              };
              
              generateAIContent();
            }
          }}
          disabled={isGenerating}
          className="mt-3 text-xs text-white/60 hover:text-white/80 transition flex items-center bg-white/10 px-3 py-1 rounded-full disabled:opacity-50"
        >
          <FaMagic size={10} className="mr-1" /> Regenerate AI Content
        </button>
      </div>
    </div>
  );
}
