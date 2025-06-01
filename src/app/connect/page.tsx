"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, useRouter } from 'next/navigation';
import { Button } from '../components/ui/Button';
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

// Define profile interface
interface Profile {
  name?: string;
  email?: string;
  phone?: string;
  bio?: string;
  picture?: string;
  // Social media usernames
  facebook?: string;
  instagram?: string;
  x?: string;
  whatsapp?: string;
  snapchat?: string;
  telegram?: string;
  linkedin?: string;
  // Add other profile properties as needed
}

// Define social link interface
interface SocialLink {
  username: string;
  url: string;
  userConfirmed: boolean;
  auto?: boolean; // For internal use only
}

// Define social links interface
interface SocialLinks {
  [key: string]: SocialLink;
}

// AI-powered bio generation
const generateAIBio = async (profile: Profile) => {
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
    const handleError = (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      console.error('Connection error:', errorMessage);
    };
    handleError(error);
    return getPlaceholderBio();
  }
};

// AI-powered background image generation
const generateAIBackground = async (profile: Profile) => {
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
    const handleError = (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      console.error('Connection error:', errorMessage);
    };
    handleError(error);
    return ''; // Return empty string to indicate no background
  }
};

// AI-powered avatar generation
const generateAIAvatar = async (profile: Profile) => {
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
    const handleError = (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      console.error('Connection error:', errorMessage);
    };
    handleError(error);
    return profile.picture || '/default-avatar.png';
  }
};

// Function to generate social links based on profile data
const generateSocialLinks = (profile: Profile): SocialLinks => {
  const links: SocialLinks = {};

  // Add phone link if phone exists
  if (profile.phone) {
    links.phone = { 
      username: profile.phone, 
      url: `tel:${profile.phone}`, 
      userConfirmed: false,
      auto: false 
    };
  }

  // Add email link if email exists
  if (profile.email) {
    links.email = { 
      username: profile.email.split('@')[0] || '', 
      url: `mailto:${profile.email}`, 
      userConfirmed: false,
      auto: true 
    };
  }

  // Add social media links if they exist in the profile
  const socialPlatforms = [
    { key: 'facebook', url: 'facebook.com' },
    { key: 'instagram', url: 'instagram.com' },
    { key: 'x', url: 'x.com' },
    { key: 'whatsapp', url: 'wa.me' },
    { key: 'snapchat', url: 'snapchat.com/add' },
    { key: 'telegram', url: 't.me' },
    { key: 'linkedin', url: 'linkedin.com/in' }
  ] as const;

  socialPlatforms.forEach(({ key, url }) => {
    const username = profile[key as keyof Profile] as string | undefined;
    if (username) {
      links[key] = { 
        username,
        url: `https://${url}/${username}`, 
        userConfirmed: false,
        auto: true 
      };
    }
  });

  return links;
};

// Validate social links (in a real app, this would make API calls to verify accounts)
const validateSocialLinks = async (links: SocialLinks): Promise<SocialLinks> => {
  // Create a new object to store validated links
  const validatedLinks: SocialLinks = {};

  // Process each link
  for (const [platform, link] of Object.entries(links)) {
    // In a real app, we would make API calls here to validate each link
    // For now, we'll simulate validation with a random chance
    const isValid = Math.random() > 0.3; // 70% chance of being valid
    
    // Create a new link object with the validation result
    validatedLinks[platform] = {
      ...link,
      userConfirmed: isValid,
      // Remove the auto flag as it's only for internal use
      auto: undefined
    };
    
    // Remove the auto property to keep the object clean
    delete (validatedLinks[platform] as Partial<SocialLink>).auto;
  }

  return validatedLinks;
};

export default function ConnectPage() {
  const { status } = useSession();
  const router = useRouter();
  const { profile, isLoading: isProfileLoading } = useProfile();
  
  const [socialLinks, setSocialLinks] = useState<SocialLinks | null>(null);
  const [bio, setBio] = useState<string>('');
  const [bgImage, setBgImage] = useState<string>('');
  const [avatarImage, setAvatarImage] = useState<string>('/default-avatar.png');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  
  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);
  
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
          setIsLoading(true);
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
          setIsLoading(false);
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
  if (status === 'loading' || isProfileLoading || isLoading) {
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
          {isLoading && (
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
          {isLoading && (
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
              {!socialLinks?.facebook.userConfirmed && socialLinks?.facebook.auto && (
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
              {!socialLinks?.instagram.userConfirmed && socialLinks?.instagram.auto && (
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
              {!socialLinks?.whatsapp.userConfirmed && socialLinks?.whatsapp.auto && (
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
              {!socialLinks?.snapchat.userConfirmed && socialLinks?.snapchat.auto && (
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
              {!socialLinks?.telegram.userConfirmed && socialLinks?.telegram.auto && (
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
              {!socialLinks?.linkedin.userConfirmed && socialLinks?.linkedin.auto && (
                <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-75">
                  <span className="text-white text-[8px]">!</span>
                </div>
              )}
            </div>
            <span className="text-white/80 text-xs mt-1">LinkedIn</span>
          </a>
        </div>
        
        {/* Nekt button */}
        <Button 
          onClick={handleNektClick}
          variant="theme"
          size="lg"
          className="w-full max-w-xs font-bold text-lg mb-4 px-8 py-3"
        >
          Nekt
        </Button>
        
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
                } catch (err) {
                  console.error('Error regenerating AI content:', err);
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
