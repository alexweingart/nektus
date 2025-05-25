"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useProfile } from '../context/ProfileContext';
import { FaPhone, FaEnvelope, FaFacebook, FaInstagram, FaWhatsapp, 
         FaSnapchat, FaTelegram, FaLinkedin, FaPen, FaExclamation } from 'react-icons/fa';
import { BluetoothConnector } from '../utils/bluetooth';

// Function to generate a bio based on profile data (in real app this would be AI-generated)
const generateBio = (name: string) => {
  const bios = [
    "Creative soul with an adventurous spirit",
    "Professional dreamer, part-time explorer",
    "Coffee lover, always smiling",
    "Digital nomad chasing sunsets",
    "Tech enthusiast with a big heart",
    "Passionate about connecting people",
    "Foodie who loves to travel",
    "Creating moments worth sharing",
    "Living life one smile at a time"
  ];
  
  // Use a deterministic approach based on name to always get the same bio for the same person
  const nameSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return bios[nameSum % bios.length];
};

// Function to generate social links based on profile data
const generateSocialLinks = (profile: any) => {
  const links = {
    phone: { url: `tel:${profile.phone}`, auto: false },
    email: { url: `mailto:${profile.email}`, auto: false }
  };
  
  // Extract username from email (text before @)
  const username = profile.email.split('@')[0];
  
  // Generate social links (these would be validated against API in a real implementation)
  return {
    ...links,
    facebook: { url: `https://facebook.com/${username}`, auto: true },
    instagram: { url: `https://instagram.com/${username}`, auto: true },
    snapchat: { url: `https://snapchat.com/add/${username}`, auto: true },
    linkedin: { url: `https://linkedin.com/in/${username}`, auto: true },
    whatsapp: { url: `https://wa.me/${profile.phone.replace(/[^0-9]/g, '')}`, auto: true },
    telegram: { url: `https://t.me/${profile.phone.replace(/[^0-9]/g, '')}`, auto: true }
  };
};

export default function ConnectPage() {
  const { status } = useSession();
  const { profile, isLoading } = useProfile();
  const router = useRouter();
  const [socialLinks, setSocialLinks] = useState<any>(null);
  const [bio, setBio] = useState<string>('');
  const [bluetoothConnector, setBluetoothConnector] = useState<any>(null);
  
  // Redirect to login if not authenticated
  if (status === 'unauthenticated') {
    redirect('/');
  }
  
  // Generate social links and bio when profile is loaded
  useEffect(() => {
    if (profile) {
      setSocialLinks(generateSocialLinks(profile));
      setBio(generateBio(profile.name));
    }
  }, [profile]);
  
  // Initialize Bluetooth connector
  useEffect(() => {
    if (profile) {
      const connector = new BluetoothConnector(
        (connected: boolean) => {}, // Connection handler
        (data: any) => {}  // Data handler
      );
      setBluetoothConnector(connector);
      
      return () => {
        if (connector) {
          connector.disconnect();
        }
      };
    }
  }, [profile]);
  
  // Handle Nekt button click - start Bluetooth scanning
  const handleNektClick = () => {
    if (bluetoothConnector && bluetoothConnector.isSupported()) {
      bluetoothConnector.startScanning();
    } else {
      alert('Bluetooth is not supported on this device');
    }
  };
  
  // Show loading state while checking authentication or profile
  if (status === 'loading' || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen p-5">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }
  
  // Redirect to profile setup if profile is incomplete
  if (!profile || !profile.phone) {
    redirect('/setup');
  }
  
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background with gradient overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center z-0" 
        style={{
          backgroundImage: `url('/gradient-bg.jpg')`,
          filter: 'blur(4px)',
          transform: 'scale(1.1)'
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70 z-10" />
      
      {/* Content container */}
      <div className="relative z-20 flex flex-col items-center px-6 py-12 max-w-md mx-auto h-full">
        {/* Profile image */}
        <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl mb-4">
          <Image 
            src={profile.picture || '/default-avatar.png'} 
            alt={profile.name}
            fill
            className="object-cover"
          />
        </div>
        
        {/* Name */}
        <h1 className="text-2xl font-bold text-white mb-1">{profile.name}</h1>
        
        {/* Bio */}
        <p className="text-white/90 text-sm mb-8 text-center">{bio}</p>
        
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
      </div>
    </div>
  );
}
