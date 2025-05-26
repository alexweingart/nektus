'use client';

import React, { useState } from 'react';
import { FaPhone, FaEnvelope, FaFacebook, FaInstagram, FaTwitter, FaLinkedin, FaSnapchatGhost, FaWhatsapp, FaTelegram } from 'react-icons/fa';

interface SocialIconProps {
  platform: 'phone' | 'email' | 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'snapchat' | 'whatsapp' | 'telegram';
  username?: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const SocialIcon: React.FC<SocialIconProps> = ({ 
  platform, 
  username, 
  size = 'md',
  onClick 
}) => {
  const [isActive, setIsActive] = useState(false);
  
  const getIconClass = () => {
    switch (size) {
      case 'sm': return 'w-4 h-4';
      case 'lg': return 'w-7 h-7';
      case 'md':
      default: return 'w-5 h-5';
    }
  };

  // Get the icon component based on platform
  const renderIcon = () => {
    switch (platform) {
      case 'phone':
        return <FaPhone className={getIconClass()} />;
      case 'email':
        return <FaEnvelope className={getIconClass()} />;
      case 'facebook':
        return <FaFacebook className={getIconClass()} />;
      case 'instagram':
        return <FaInstagram className={getIconClass()} />;
      case 'twitter':
        return <FaTwitter className={getIconClass()} />;
      case 'linkedin':
        return <FaLinkedin className={getIconClass()} />;
      case 'snapchat':
        return <FaSnapchatGhost className={getIconClass()} />;
      case 'whatsapp':
        return <FaWhatsapp className={getIconClass()} />;
      case 'telegram':
        return <FaTelegram className={getIconClass()} />;
      default:
        return null;
    }
  };

  const getContainerSize = () => {
    switch (size) {
      case 'sm': return 'w-8 h-8';
      case 'lg': return 'w-14 h-14';
      case 'md':
      default: return 'w-12 h-12';
    }
  };

  const handleClick = () => {
    setIsActive(!isActive);
    if (onClick) {
      onClick();
    }
  };

  return (
    <div 
      className="cursor-pointer"
      onClick={handleClick}
    >
      <div 
        className={`
          ${getContainerSize()} 
          flex items-center justify-center 
          rounded-full 
          transition-colors duration-200
          ${isActive ? 'bg-gray-500' : 'bg-gray-400 hover:bg-gray-500'}
        `}
      >
        <div className={`${isActive ? 'text-green-500' : 'text-white'}`}>
          {renderIcon()}
        </div>
      </div>
    </div>
  );
};

export default SocialIcon;
